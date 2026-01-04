/*******************************************************************************
 * GlyphtenderLobby.cs
 *
 * PURPOSE:
 *   Manages lobby creation and joining using Unity Lobby service.
 *   Handles room codes, lobby data, and player presence.
 *
 * RESPONSIBILITIES:
 *   - Create lobbies with 6-character room codes
 *   - Join lobbies by room code
 *   - Store game settings in lobby data (board size, 2-letter toggle)
 *   - Handle lobby heartbeat to prevent timeout
 *   - Track lobby state and player presence
 *
 * ARCHITECTURE:
 *   - Singleton pattern for global access
 *   - Requires NetworkServices to be initialized first
 *   - Works with GlyphtenderRelay for actual connection
 *
 * USAGE:
 *   string roomCode = await GlyphtenderLobby.Instance.CreateLobbyAsync(settings);
 *   bool joined = await GlyphtenderLobby.Instance.JoinLobbyByCodeAsync("ABC123");
 ******************************************************************************/

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using Unity.Services.Lobbies;
using Unity.Services.Lobbies.Models;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Lobby state tracking.
    /// </summary>
    public enum LobbyState
    {
        None,
        Creating,
        Joining,
        Waiting,      // Host waiting for guest
        Ready,        // Both players present
        InGame,       // Game started
        Error
    }

    /// <summary>
    /// Game settings stored in lobby data.
    /// </summary>
    [Serializable]
    public class LobbyGameSettings
    {
        public int BoardSizeIndex;      // 0 = Medium, 1 = Large
        public bool Allow2LetterWords;
    }

    /// <summary>
    /// Manages lobby creation and joining using Unity Lobby service.
    /// </summary>
    public class GlyphtenderLobby : MonoBehaviour
    {
        public static GlyphtenderLobby Instance { get; private set; }

        // Lobby settings
        private const int MAX_PLAYERS = 2;
        private const float HEARTBEAT_INTERVAL = 15f;  // Lobby timeout prevention
        private const float LOBBY_POLL_INTERVAL = 1.5f;  // Check for updates

        // Current lobby state
        public Lobby CurrentLobby { get; private set; }
        public LobbyState State { get; private set; } = LobbyState.None;
        public string RoomCode => CurrentLobby?.LobbyCode ?? "";
        public bool IsHost { get; private set; }
        public string LastError { get; private set; }

        // Events
        public event Action<string> OnLobbyCreated;       // Room code
        public event Action OnPlayerJoined;               // Guest joined
        public event Action OnLobbyJoined;                // Successfully joined as guest
        public event Action OnLobbyLeft;
        public event Action<string> OnError;
        public event Action<LobbyState> OnStateChanged;

        // Timers
        private float _heartbeatTimer;
        private float _pollTimer;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Update()
        {
            if (CurrentLobby == null) return;

            // Host heartbeat to prevent lobby expiration
            if (IsHost)
            {
                _heartbeatTimer -= Time.deltaTime;
                if (_heartbeatTimer <= 0)
                {
                    _heartbeatTimer = HEARTBEAT_INTERVAL;
                    _ = SendHeartbeatAsync();
                }
            }

            // Poll for lobby updates (player joined, etc.)
            if (State == LobbyState.Waiting || State == LobbyState.Ready)
            {
                _pollTimer -= Time.deltaTime;
                if (_pollTimer <= 0)
                {
                    _pollTimer = LOBBY_POLL_INTERVAL;
                    _ = PollLobbyAsync();
                }
            }
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                _ = LeaveLobbyAsync();
                Instance = null;
            }
        }

        /// <summary>
        /// Creates a new lobby and returns the room code.
        /// </summary>
        public async Task<string> CreateLobbyAsync(LobbyGameSettings settings)
        {
            if (!NetworkServices.Instance.IsSignedIn)
            {
                LastError = "Not signed in. Call NetworkServices.InitializeAsync() first.";
                OnError?.Invoke(LastError);
                return null;
            }

            SetState(LobbyState.Creating);

            try
            {
                // Create lobby options with game settings
                var options = new CreateLobbyOptions
                {
                    IsPrivate = false,  // Public so room code works
                    Data = new Dictionary<string, DataObject>
                    {
                        { "boardSize", new DataObject(DataObject.VisibilityOptions.Public, settings.BoardSizeIndex.ToString()) },
                        { "allow2Letter", new DataObject(DataObject.VisibilityOptions.Public, settings.Allow2LetterWords.ToString()) },
                        { "relayCode", new DataObject(DataObject.VisibilityOptions.Member, "") }  // Set later
                    }
                };

                // Create the lobby
                CurrentLobby = await LobbyService.Instance.CreateLobbyAsync(
                    "Glyphtender Match",
                    MAX_PLAYERS,
                    options
                );

                IsHost = true;
                _heartbeatTimer = HEARTBEAT_INTERVAL;
                _pollTimer = LOBBY_POLL_INTERVAL;

                SetState(LobbyState.Waiting);
                Debug.Log($"[GlyphtenderLobby] Created lobby. Room code: {RoomCode}");

                OnLobbyCreated?.Invoke(RoomCode);
                return RoomCode;
            }
            catch (LobbyServiceException ex)
            {
                LastError = $"Failed to create lobby: {ex.Message}";
                Debug.LogError($"[GlyphtenderLobby] {LastError}");
                SetState(LobbyState.Error);
                OnError?.Invoke(LastError);
                return null;
            }
        }

        /// <summary>
        /// Joins an existing lobby by room code.
        /// </summary>
        public async Task<bool> JoinLobbyByCodeAsync(string roomCode)
        {
            if (!NetworkServices.Instance.IsSignedIn)
            {
                LastError = "Not signed in. Call NetworkServices.InitializeAsync() first.";
                OnError?.Invoke(LastError);
                return false;
            }

            if (string.IsNullOrEmpty(roomCode))
            {
                LastError = "Room code cannot be empty.";
                OnError?.Invoke(LastError);
                return false;
            }

            SetState(LobbyState.Joining);

            try
            {
                CurrentLobby = await LobbyService.Instance.JoinLobbyByCodeAsync(roomCode.ToUpper());
                IsHost = false;
                _pollTimer = LOBBY_POLL_INTERVAL;

                SetState(LobbyState.Ready);
                Debug.Log($"[GlyphtenderLobby] Joined lobby: {RoomCode}");

                OnLobbyJoined?.Invoke();
                return true;
            }
            catch (LobbyServiceException ex)
            {
                if (ex.Reason == LobbyExceptionReason.LobbyNotFound)
                {
                    LastError = "Room not found. Check the code and try again.";
                }
                else if (ex.Reason == LobbyExceptionReason.LobbyFull)
                {
                    LastError = "Room is full.";
                }
                else
                {
                    LastError = $"Failed to join lobby: {ex.Message}";
                }
                Debug.LogError($"[GlyphtenderLobby] {LastError}");
                SetState(LobbyState.Error);
                OnError?.Invoke(LastError);
                return false;
            }
        }

        /// <summary>
        /// Leaves the current lobby.
        /// </summary>
        public async Task LeaveLobbyAsync()
        {
            if (CurrentLobby == null) return;

            try
            {
                string lobbyId = CurrentLobby.Id;

                if (IsHost)
                {
                    // Host deletes the lobby
                    await LobbyService.Instance.DeleteLobbyAsync(lobbyId);
                    Debug.Log("[GlyphtenderLobby] Deleted lobby (host left)");
                }
                else
                {
                    // Guest removes themselves
                    await LobbyService.Instance.RemovePlayerAsync(lobbyId, NetworkServices.Instance.PlayerId);
                    Debug.Log("[GlyphtenderLobby] Left lobby (guest left)");
                }
            }
            catch (LobbyServiceException ex)
            {
                Debug.LogWarning($"[GlyphtenderLobby] Error leaving lobby: {ex.Message}");
            }
            finally
            {
                CurrentLobby = null;
                IsHost = false;
                SetState(LobbyState.None);
                OnLobbyLeft?.Invoke();
            }
        }

        /// <summary>
        /// Updates lobby data (e.g., to store relay join code).
        /// </summary>
        public async Task<bool> UpdateLobbyDataAsync(string key, string value)
        {
            if (CurrentLobby == null || !IsHost) return false;

            try
            {
                var options = new UpdateLobbyOptions
                {
                    Data = new Dictionary<string, DataObject>
                    {
                        { key, new DataObject(DataObject.VisibilityOptions.Member, value) }
                    }
                };

                CurrentLobby = await LobbyService.Instance.UpdateLobbyAsync(CurrentLobby.Id, options);
                return true;
            }
            catch (LobbyServiceException ex)
            {
                Debug.LogError($"[GlyphtenderLobby] Failed to update lobby data: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Gets a value from lobby data.
        /// </summary>
        public string GetLobbyData(string key)
        {
            if (CurrentLobby?.Data == null) return null;
            return CurrentLobby.Data.TryGetValue(key, out var data) ? data.Value : null;
        }

        /// <summary>
        /// Gets the game settings from lobby data.
        /// </summary>
        public LobbyGameSettings GetGameSettings()
        {
            if (CurrentLobby?.Data == null) return null;

            var settings = new LobbyGameSettings();

            if (CurrentLobby.Data.TryGetValue("boardSize", out var boardSize))
            {
                int.TryParse(boardSize.Value, out settings.BoardSizeIndex);
            }

            if (CurrentLobby.Data.TryGetValue("allow2Letter", out var allow2Letter))
            {
                bool.TryParse(allow2Letter.Value, out settings.Allow2LetterWords);
            }

            return settings;
        }

        /// <summary>
        /// Returns the number of players currently in the lobby.
        /// </summary>
        public int PlayerCount => CurrentLobby?.Players?.Count ?? 0;

        /// <summary>
        /// Returns true if lobby has 2 players.
        /// </summary>
        public bool IsFull => PlayerCount >= MAX_PLAYERS;

        private async Task SendHeartbeatAsync()
        {
            if (CurrentLobby == null) return;

            try
            {
                await LobbyService.Instance.SendHeartbeatPingAsync(CurrentLobby.Id);
            }
            catch (LobbyServiceException ex)
            {
                Debug.LogWarning($"[GlyphtenderLobby] Heartbeat failed: {ex.Message}");
            }
        }

        private async Task PollLobbyAsync()
        {
            if (CurrentLobby == null) return;

            try
            {
                var previousPlayerCount = PlayerCount;
                CurrentLobby = await LobbyService.Instance.GetLobbyAsync(CurrentLobby.Id);

                // Check if player count changed
                if (IsHost && PlayerCount > previousPlayerCount && IsFull)
                {
                    SetState(LobbyState.Ready);
                    Debug.Log("[GlyphtenderLobby] Guest joined!");
                    OnPlayerJoined?.Invoke();
                }
            }
            catch (LobbyServiceException ex)
            {
                if (ex.Reason == LobbyExceptionReason.LobbyNotFound)
                {
                    Debug.LogWarning("[GlyphtenderLobby] Lobby no longer exists");
                    CurrentLobby = null;
                    SetState(LobbyState.None);
                    OnLobbyLeft?.Invoke();
                }
            }
        }

        private void SetState(LobbyState newState)
        {
            if (State != newState)
            {
                State = newState;
                OnStateChanged?.Invoke(newState);
            }
        }
    }
}
