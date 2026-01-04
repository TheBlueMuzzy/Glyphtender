/*******************************************************************************
 * NetworkedGameManager.cs
 *
 * PURPOSE:
 *   Bridges GameManager with NetworkGameBridge for online multiplayer.
 *   Intercepts player actions and routes them through the network.
 *
 * RESPONSIBILITIES:
 *   - Detect when game is in online mode
 *   - Intercept local player actions and send to host
 *   - Receive remote player actions and apply to GameManager
 *   - Sync initial game state from host to client
 *   - Handle online-specific logic (which player is local)
 *
 * ARCHITECTURE:
 *   - Companion component to GameManager
 *   - Subscribes to NetworkGameBridge events
 *   - Only active during Online1v1 mode
 *
 * USAGE:
 *   Automatically activates when PlayMode is Online1v1
 ******************************************************************************/

using UnityEngine;
using Unity.Netcode;
using Glyphtender.Core;
using Glyphtender.Unity.Network;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Manages network synchronization for online multiplayer games.
    /// Works alongside GameManager to sync game state between host and client.
    /// </summary>
    public class NetworkedGameManager : MonoBehaviour
    {
        public static NetworkedGameManager Instance { get; private set; }

        /// <summary>
        /// True if we're in an online game.
        /// </summary>
        public bool IsOnlineGame { get; private set; }

        /// <summary>
        /// The local player (Yellow for host, Blue for client).
        /// </summary>
        public Player LocalPlayer { get; private set; }

        /// <summary>
        /// True if it's the local player's turn.
        /// </summary>
        public bool IsLocalPlayerTurn
        {
            get
            {
                if (!IsOnlineGame || GameManager.Instance?.GameState == null)
                    return true; // Not online, always local

                if (GameManager.Instance.GameState.Phase == GamePhase.Draft)
                {
                    return GameManager.Instance.GameState.CurrentDrafter == LocalPlayer;
                }

                return GameManager.Instance.GameState.CurrentPlayer == LocalPlayer;
            }
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Subscribe to game events
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized += OnGameInitialized;

                // If game was already initialized before we subscribed, check now
                if (GameManager.Instance.GameState != null && !GameManager.Instance.WaitingForMainMenu)
                {
                    Debug.Log("[NetworkedGameManager] Game already initialized, checking online status now");
                    OnGameInitialized();
                }
            }
            else
            {
                Debug.LogWarning("[NetworkedGameManager] GameManager.Instance is null in Start()");
            }

            // Subscribe to network events
            SubscribeToNetworkEvents();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized -= OnGameInitialized;
            }

            UnsubscribeFromNetworkEvents();

            if (Instance == this)
            {
                Instance = null;
            }
        }

        private void SubscribeToNetworkEvents()
        {
            if (NetworkGameBridge.Instance == null) return;

            NetworkGameBridge.Instance.OnTurnConfirmed += OnNetworkTurnConfirmed;
            NetworkGameBridge.Instance.OnDraftPlacementConfirmed += OnNetworkDraftPlacementConfirmed;
            NetworkGameBridge.Instance.OnCycleConfirmed += OnNetworkCycleConfirmed;
            NetworkGameBridge.Instance.OnGameStartReceived += OnNetworkGameStartReceived;
            NetworkGameBridge.Instance.OnForfeitReceived += OnNetworkForfeitReceived;
        }

        private void UnsubscribeFromNetworkEvents()
        {
            if (NetworkGameBridge.Instance == null) return;

            NetworkGameBridge.Instance.OnTurnConfirmed -= OnNetworkTurnConfirmed;
            NetworkGameBridge.Instance.OnDraftPlacementConfirmed -= OnNetworkDraftPlacementConfirmed;
            NetworkGameBridge.Instance.OnCycleConfirmed -= OnNetworkCycleConfirmed;
            NetworkGameBridge.Instance.OnGameStartReceived -= OnNetworkGameStartReceived;
            NetworkGameBridge.Instance.OnForfeitReceived -= OnNetworkForfeitReceived;
        }

        private void OnGameInitialized()
        {
            // Check if this is an online game
            // Check multiple sources since SettingsManager might not be set yet
            var playMode = SettingsManager.Instance?.PlayMode;

            // Also check if we have an active network session as a backup indicator
            bool hasNetworkSession = GlyphtenderLobby.Instance?.CurrentLobby != null ||
                                     GlyphtenderRelay.Instance?.State == RelayState.Connected;

            Debug.Log($"[NetworkedGameManager] OnGameInitialized called. PlayMode={playMode}, HasNetworkSession={hasNetworkSession}");

            // Consider it online if either PlayMode says so OR we have an active network session
            if (playMode == PlayMode.Online1v1 || hasNetworkSession)
            {
                IsOnlineGame = true;

                // Determine if we're host or guest
                // Check multiple sources for reliability
                bool isHost = false;

                // Primary: Check GlyphtenderLobby (most reliable - set when creating/joining lobby)
                if (GlyphtenderLobby.Instance != null)
                {
                    isHost = GlyphtenderLobby.Instance.IsHost;
                    Debug.Log($"[NetworkedGameManager] GlyphtenderLobby.IsHost = {isHost}");
                }
                // Secondary: Check GlyphtenderRelay (set during allocation/join)
                else if (GlyphtenderRelay.Instance != null)
                {
                    isHost = GlyphtenderRelay.Instance.IsHost;
                    Debug.Log($"[NetworkedGameManager] Using GlyphtenderRelay.IsHost = {isHost}");
                }

                // Debug: also log NetworkManager state
                var netManager = global::Unity.Netcode.NetworkManager.Singleton;
                if (netManager != null)
                {
                    Debug.Log($"[NetworkedGameManager] NetworkManager.IsHost = {netManager.IsHost}, IsClient = {netManager.IsClient}, IsServer = {netManager.IsServer}");
                }

                LocalPlayer = isHost ? Player.Yellow : Player.Blue;
                Debug.Log($"[NetworkedGameManager] Online game started. isHost={isHost}, LocalPlayer={LocalPlayer}");

                // If host, broadcast initial game state
                if (isHost)
                {
                    BroadcastInitialGameState();
                }
            }
            else
            {
                IsOnlineGame = false;
                Debug.Log("[NetworkedGameManager] Not an online game");
            }
        }

        /// <summary>
        /// Host broadcasts the initial game state to the client.
        /// </summary>
        private void BroadcastInitialGameState()
        {
            // Use GlyphtenderLobby.IsHost since NetworkManager.IsHost may not be ready
            bool isHost = GlyphtenderLobby.Instance?.IsHost ?? false;
            if (!isHost) return;
            if (GameManager.Instance?.GameState == null) return;

            var gameState = GameManager.Instance.GameState;

            // Build tile bag string
            string tileBag = new string(gameState.TileBag.ToArray());

            // Build hand strings
            string yellowHand = new string(gameState.Hands[Player.Yellow].ToArray());
            string blueHand = new string(gameState.Hands[Player.Blue].ToArray());

            var gameStart = new NetworkGameStart
            {
                TileBagOrder = tileBag,
                YellowHand = yellowHand,
                BlueHand = blueHand,
                BoardSizeIndex = SettingsManager.Instance?.BoardSizeIndex ?? 1,
                Allow2LetterWords = SettingsManager.Instance?.Allow2LetterWords ?? true
            };

            NetworkGameBridge.Instance?.BroadcastGameStart(gameStart);
            Debug.Log("[NetworkedGameManager] Broadcast initial game state to client");
        }

        #region Network Event Handlers

        private void OnNetworkGameStartReceived(NetworkGameStart gameStart)
        {
            // Client receives initial game state from host
            Debug.Log($"[NetworkedGameManager] Received game start: TileBag={gameStart.TileBagOrder.Length} chars");

            if (GameManager.Instance?.GameState == null)
            {
                Debug.LogWarning("[NetworkedGameManager] GameState is null, cannot apply network game start");
                return;
            }

            var state = GameManager.Instance.GameState;

            // Apply tile bag from host (so both clients draw in same order)
            state.TileBag.Clear();
            string tileBagStr = gameStart.TileBagOrder.ToString();
            for (int i = 0; i < tileBagStr.Length; i++)
            {
                state.TileBag.Add(tileBagStr[i]);
            }

            // Apply hands from host
            state.Hands[Player.Yellow].Clear();
            string yellowHandStr = gameStart.YellowHand.ToString();
            for (int i = 0; i < yellowHandStr.Length; i++)
            {
                state.Hands[Player.Yellow].Add(yellowHandStr[i]);
            }

            state.Hands[Player.Blue].Clear();
            string blueHandStr = gameStart.BlueHand.ToString();
            for (int i = 0; i < blueHandStr.Length; i++)
            {
                state.Hands[Player.Blue].Add(blueHandStr[i]);
            }

            Debug.Log($"[NetworkedGameManager] Applied game state: TileBag={state.TileBag.Count}, YellowHand={state.Hands[Player.Yellow].Count}, BlueHand={state.Hands[Player.Blue].Count}");

            // Refresh the hand display to show the correct hand
            if (HandController.Instance != null)
            {
                HandController.Instance.RefreshHand();
            }
        }

        private void OnNetworkTurnConfirmed(NetworkTurnData turnData)
        {
            if (!IsOnlineGame) return;

            // If this is the remote player's turn, apply it
            Debug.Log($"[NetworkedGameManager] Turn confirmed from network");

            // TODO: Apply the move and cast to GameManager
            // This would involve calling GameManager methods to execute the turn
        }

        private void OnNetworkDraftPlacementConfirmed(NetworkDraftPlacement placement)
        {
            if (!IsOnlineGame) return;

            var pos = placement.Position.ToHexCoord();
            Debug.Log($"[NetworkedGameManager] Draft placement confirmed at ({pos.Column},{pos.Row})");

            // Apply draft placement to GameManager
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;

            // Only apply if we're in draft phase
            if (state.Phase != GamePhase.Draft)
            {
                Debug.LogWarning("[NetworkedGameManager] Received draft placement but not in draft phase");
                return;
            }

            // Apply the placement directly to game state (bypass GameManager validation since host already validated)
            bool success = GameRules.PlaceDraftGlyphling(state, pos);
            if (!success)
            {
                Debug.LogError($"[NetworkedGameManager] Failed to place draft glyphling at {pos}");
                return;
            }

            Debug.Log($"[NetworkedGameManager] Applied draft placement. Phase now: {state.Phase}, CurrentDrafter: {state.CurrentDrafter}");

            // Refresh visuals
            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
                BoardRenderer.Instance.RefreshHighlights();
            }

            if (HandController.Instance != null)
            {
                HandController.Instance.RefreshHand();
            }

            // Check if draft is complete
            if (state.Phase == GamePhase.Play)
            {
                Debug.Log("[NetworkedGameManager] Draft phase complete, transitioning to play");
            }

            // Update turn indicator
            if (TurnIndicator.Instance != null)
            {
                TurnIndicator.Instance.UpdateIndicator();
            }
        }

        private void OnNetworkCycleConfirmed(NetworkCycleData cycleData)
        {
            if (!IsOnlineGame) return;

            Debug.Log($"[NetworkedGameManager] Cycle confirmed with mask {cycleData.DiscardMask}");

            // TODO: Apply cycle to GameManager
        }

        private void OnNetworkForfeitReceived(NetworkForfeit forfeit)
        {
            if (!IsOnlineGame) return;

            Debug.Log($"[NetworkedGameManager] {forfeit.GetPlayer()} forfeited");

            // TODO: Handle forfeit - end game, show message, maybe AI takeover option
        }

        #endregion

        #region Local Action Interceptors

        /// <summary>
        /// Called before local player confirms a move.
        /// Returns true if the action should proceed locally, false if waiting for network.
        /// </summary>
        public bool ShouldAllowLocalAction()
        {
            if (!IsOnlineGame) return true;

            // Only allow local actions on local player's turn
            return IsLocalPlayerTurn;
        }

        /// <summary>
        /// Sends a turn to the host for validation.
        /// </summary>
        public void SendTurnToNetwork(HexCoord moveFrom, HexCoord moveTo, HexCoord castPosition, char letter, int glyphlingIndex)
        {
            if (!IsOnlineGame) return;
            if (NetworkGameBridge.Instance == null) return;

            var turnData = new NetworkTurnData
            {
                Move = new NetworkMoveData
                {
                    GlyphlingIndex = glyphlingIndex,
                    From = new NetworkHexCoord(moveFrom),
                    To = new NetworkHexCoord(moveTo)
                },
                Cast = new NetworkCastData
                {
                    Position = new NetworkHexCoord(castPosition),
                    Letter = (byte)letter
                }
            };

            NetworkGameBridge.Instance.RequestTurnServerRpc(turnData);
        }

        /// <summary>
        /// Sends a draft placement to the host for validation.
        /// </summary>
        public void SendDraftPlacementToNetwork(HexCoord position)
        {
            if (!IsOnlineGame) return;
            if (NetworkGameBridge.Instance == null) return;

            var placement = new NetworkDraftPlacement
            {
                Position = new NetworkHexCoord(position)
            };

            NetworkGameBridge.Instance.RequestDraftPlacementServerRpc(placement);
        }

        /// <summary>
        /// Sends cycle data to the host.
        /// </summary>
        public void SendCycleToNetwork(byte discardMask)
        {
            if (!IsOnlineGame) return;
            if (NetworkGameBridge.Instance == null) return;

            var cycleData = new NetworkCycleData
            {
                DiscardMask = discardMask
            };

            NetworkGameBridge.Instance.RequestCycleServerRpc(cycleData);
        }

        /// <summary>
        /// Sends forfeit to the host.
        /// </summary>
        public void SendForfeit()
        {
            if (!IsOnlineGame) return;
            if (NetworkGameBridge.Instance == null) return;

            NetworkGameBridge.Instance.RequestForfeitServerRpc();
        }

        #endregion
    }
}
