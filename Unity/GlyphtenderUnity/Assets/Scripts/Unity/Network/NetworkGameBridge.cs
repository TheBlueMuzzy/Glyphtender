/*******************************************************************************
 * NetworkGameBridge.cs
 *
 * PURPOSE:
 *   Bridges network messages with game logic.
 *   Receives RPCs from clients and applies them to GameManager.
 *   Sends game state updates to all clients.
 *
 * RESPONSIBILITIES:
 *   - Receive move/cast/draft RPCs from clients
 *   - Validate moves on host before applying
 *   - Broadcast confirmed actions to all clients
 *   - Sync initial game state at match start
 *   - Handle forfeit and rematch flow
 *
 * ARCHITECTURE:
 *   - NetworkBehaviour for Netcode integration
 *   - Host-authoritative: clients send requests, host validates and broadcasts
 *   - Events for UI to react to network actions
 *
 * USAGE:
 *   // Client sends turn request:
 *   NetworkGameBridge.Instance.RequestTurnServerRpc(turnData);
 *
 *   // All clients receive confirmed turn:
 *   NetworkGameBridge.Instance.OnTurnConfirmed += HandleTurnConfirmed;
 ******************************************************************************/

using System;
using UnityEngine;
using Unity.Netcode;
using Glyphtender.Core;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Bridges network RPCs with game logic.
    /// Host validates all actions before broadcasting to clients.
    /// </summary>
    public class NetworkGameBridge : NetworkBehaviour
    {
        public static NetworkGameBridge Instance { get; private set; }

        // Events for game actions (fired on all clients after host validation)
        public event Action<NetworkTurnData> OnTurnConfirmed;
        public event Action<NetworkDraftPlacement> OnDraftPlacementConfirmed;
        public event Action<NetworkCycleData> OnCycleConfirmed;
        public event Action<NetworkGameStart> OnGameStartReceived;
        public event Action<NetworkForfeit> OnForfeitReceived;
        public event Action<NetworkRematch> OnRematchReceived;
        public event Action<NetworkRematchStatus> OnRematchStatusReceived;

        // Event for validation failures (client-side feedback)
        public event Action<string> OnActionRejected;

        // Track if we're the host player (Yellow)
        // Note: Use GlyphtenderLobby.IsHost instead of NetworkBehaviour.IsHost
        // because NetworkBehaviour.IsHost only works after network session starts
        public bool IsHostPlayer => GlyphtenderLobby.Instance?.IsHost ?? IsHost;

        /// <summary>
        /// Gets the local player based on client ID.
        /// Client IDs are assigned in join order: 0=Host=Yellow, 1=Blue, 2=Purple, 3=Pink
        /// </summary>
        public Player LocalPlayer
        {
            get
            {
                if (NetworkManager.Singleton == null || !NetworkManager.Singleton.IsClient)
                    return Player.Yellow;  // Fallback for offline/not connected
                return GetPlayerFromClientId(NetworkManager.Singleton.LocalClientId);
            }
        }

        /// <summary>
        /// Returns all remote players (everyone except LocalPlayer).
        /// For 2-player games returns single player, for 3-4 player games returns 2-3 players.
        /// </summary>
        public System.Collections.Generic.IEnumerable<Player> RemotePlayers
        {
            get
            {
                Player local = LocalPlayer;
                int playerCount = GameManager.Instance?.GameState?.PlayerCount ?? 2;
                for (int i = 0; i < playerCount; i++)
                {
                    Player p = (Player)i;
                    if (p != local)
                        yield return p;
                }
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

        public override void OnDestroy()
        {
            base.OnDestroy();
            if (Instance == this)
            {
                Instance = null;
            }
        }

        #region Client -> Server RPCs

        /// <summary>
        /// Client requests a complete turn (move + cast).
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestTurnServerRpc(NetworkTurnData turnData, ServerRpcParams rpcParams = default)
        {
            Debug.Log($"[NetworkGameBridge] RequestTurnServerRpc RECEIVED from client {rpcParams.Receive.SenderClientId}");

            // Validate the requesting client is the current player
            if (!ValidateClientTurn(rpcParams.Receive.SenderClientId))
            {
                RejectActionClientRpc("Not your turn", CreateClientRpcParams(rpcParams.Receive.SenderClientId));
                return;
            }

            // Validate the move with GameRules
            var fromCoord = turnData.Move.From.ToHexCoord();
            var toCoord = turnData.Move.To.ToHexCoord();
            var castCoord = turnData.Cast.Position.ToHexCoord();

            // TODO: Add full validation using GameRules once integrated
            // For now, trust the client and broadcast

            Debug.Log($"[NetworkGameBridge] Turn validated from client {rpcParams.Receive.SenderClientId}");

            // Broadcast confirmed turn to all clients
            ConfirmTurnClientRpc(turnData);
        }

        /// <summary>
        /// Client requests a draft placement.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestDraftPlacementServerRpc(NetworkDraftPlacement placement, ServerRpcParams rpcParams = default)
        {
            if (!ValidateClientTurn(rpcParams.Receive.SenderClientId))
            {
                RejectActionClientRpc("Not your turn to draft", CreateClientRpcParams(rpcParams.Receive.SenderClientId));
                return;
            }

            // TODO: Validate placement with GameRules

            Debug.Log($"[NetworkGameBridge] Draft placement validated from client {rpcParams.Receive.SenderClientId}");

            ConfirmDraftPlacementClientRpc(placement);
        }

        /// <summary>
        /// Client requests tile cycling.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestCycleServerRpc(NetworkCycleData cycleData, ServerRpcParams rpcParams = default)
        {
            if (!ValidateClientTurn(rpcParams.Receive.SenderClientId))
            {
                RejectActionClientRpc("Not your turn", CreateClientRpcParams(rpcParams.Receive.SenderClientId));
                return;
            }

            Debug.Log($"[NetworkGameBridge] Cycle validated from client {rpcParams.Receive.SenderClientId}");

            ConfirmCycleClientRpc(cycleData);
        }

        /// <summary>
        /// Client forfeits the game.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestForfeitServerRpc(ServerRpcParams rpcParams = default)
        {
            Player forfeitingPlayer = GetPlayerFromClientId(rpcParams.Receive.SenderClientId);

            var forfeit = new NetworkForfeit();
            forfeit.SetPlayer(forfeitingPlayer);

            Debug.Log($"[NetworkGameBridge] {forfeitingPlayer} forfeits");

            BroadcastForfeitClientRpc(forfeit);
        }

        /// <summary>
        /// Client requests or responds to rematch (legacy).
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestRematchServerRpc(NetworkRematch rematch, ServerRpcParams rpcParams = default)
        {
            Debug.Log($"[NetworkGameBridge] Rematch request: IsRequest={rematch.IsRequest}, Accepted={rematch.Accepted}");

            BroadcastRematchClientRpc(rematch);
        }

        /// <summary>
        /// Client requests a rematch status change (new per-player flow).
        /// Host validates the sender and broadcasts to all clients.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestRematchStatusServerRpc(NetworkRematchStatus status, ServerRpcParams rpcParams = default)
        {
            // Validate sender matches the player in the status
            Player senderPlayer = GetPlayerFromClientId(rpcParams.Receive.SenderClientId);
            if ((int)senderPlayer != status.PlayerIndex)
            {
                Debug.LogWarning($"[NetworkGameBridge] Rematch status mismatch: sender is {senderPlayer} but status is for {status.GetPlayer()}");
                return;
            }

            // If this is first Confirmed and timer not started, set timer fields
            if (status.GetStatus() == RematchStatus.Confirmed && status.TimerStartTime == 0)
            {
                status.TimerStartTime = Time.time;
                status.TimerDuration = RematchManager.Instance?.RematchTimerDuration ?? 30f;
                Debug.Log($"[NetworkGameBridge] Starting rematch timer: {status.TimerDuration}s");
            }

            Debug.Log($"[NetworkGameBridge] Rematch status from {senderPlayer}: {status.GetStatus()}");

            BroadcastRematchStatusClientRpc(status);
        }

        #endregion

        #region Server -> Client RPCs

        [ClientRpc]
        private void ConfirmTurnClientRpc(NetworkTurnData turnData)
        {
            Debug.Log($"[NetworkGameBridge] Turn confirmed: Move to ({turnData.Move.To.Column},{turnData.Move.To.Row}), Cast '{turnData.Cast.GetLetter()}' at ({turnData.Cast.Position.Column},{turnData.Cast.Position.Row})");
            OnTurnConfirmed?.Invoke(turnData);
        }

        [ClientRpc]
        private void ConfirmDraftPlacementClientRpc(NetworkDraftPlacement placement)
        {
            Debug.Log($"[NetworkGameBridge] Draft placement confirmed at ({placement.Position.Column},{placement.Position.Row})");
            OnDraftPlacementConfirmed?.Invoke(placement);
        }

        [ClientRpc]
        private void ConfirmCycleClientRpc(NetworkCycleData cycleData)
        {
            Debug.Log($"[NetworkGameBridge] Cycle confirmed with mask {cycleData.DiscardMask}");
            OnCycleConfirmed?.Invoke(cycleData);
        }

        [ClientRpc]
        private void BroadcastForfeitClientRpc(NetworkForfeit forfeit)
        {
            Debug.Log($"[NetworkGameBridge] Forfeit received: {forfeit.GetPlayer()}");
            OnForfeitReceived?.Invoke(forfeit);
        }

        [ClientRpc]
        private void BroadcastRematchClientRpc(NetworkRematch rematch)
        {
            Debug.Log($"[NetworkGameBridge] Rematch broadcast: IsRequest={rematch.IsRequest}, Accepted={rematch.Accepted}");
            OnRematchReceived?.Invoke(rematch);
        }

        [ClientRpc]
        private void BroadcastRematchStatusClientRpc(NetworkRematchStatus status)
        {
            Debug.Log($"[NetworkGameBridge] Rematch status broadcast: {status.GetPlayer()} = {status.GetStatus()}");
            OnRematchStatusReceived?.Invoke(status);
        }

        [ClientRpc]
        private void RejectActionClientRpc(string reason, ClientRpcParams rpcParams = default)
        {
            Debug.LogWarning($"[NetworkGameBridge] Action rejected: {reason}");
            OnActionRejected?.Invoke(reason);
        }

        /// <summary>
        /// Host sends initial game state to client when game starts.
        /// </summary>
        [ClientRpc]
        public void SendGameStartClientRpc(NetworkGameStart gameStart)
        {
            if (IsHost)
            {
                // Host already has the state, don't process
                return;
            }

            Debug.Log($"[NetworkGameBridge] Received game start data");
            OnGameStartReceived?.Invoke(gameStart);
        }

        #endregion

        #region Host-Only Methods

        /// <summary>
        /// Called by host to broadcast the initial game state.
        /// </summary>
        public void BroadcastGameStart(NetworkGameStart gameStart)
        {
            // Use lobby's IsHost check since NetworkBehaviour.IsHost may not be ready yet
            if (!IsHostPlayer)
            {
                Debug.LogError("[NetworkGameBridge] Only host can broadcast game start");
                return;
            }

            // Check if we're actually spawned and can send RPCs
            if (!IsSpawned)
            {
                Debug.LogWarning("[NetworkGameBridge] Cannot broadcast game start - not yet spawned on network. Will retry when client connects.");
                return;
            }

            SendGameStartClientRpc(gameStart);
        }

        #endregion

        #region Validation Helpers

        private bool ValidateClientTurn(ulong clientId)
        {
            // In 1v1: Host (clientId 0) is Yellow, Client is Blue
            Player requestingPlayer = GetPlayerFromClientId(clientId);

            // TODO: Check GameManager.Instance.CurrentPlayer
            // For now, return true
            return true;
        }

        /// <summary>
        /// Maps client ID to Player enum.
        /// Client IDs are assigned in join order: 0=Yellow, 1=Blue, 2=Purple, 3=Pink
        /// </summary>
        private Player GetPlayerFromClientId(ulong clientId)
        {
            // Client IDs are assigned in join order by Unity Netcode
            // Host = 0 = Yellow, Guest1 = 1 = Blue, Guest2 = 2 = Purple, Guest3 = 3 = Pink
            int playerIndex = (int)System.Math.Min(clientId, 3);  // Clamp to valid range
            return (Player)playerIndex;
        }

        private ClientRpcParams CreateClientRpcParams(ulong targetClientId)
        {
            return new ClientRpcParams
            {
                Send = new ClientRpcSendParams
                {
                    TargetClientIds = new ulong[] { targetClientId }
                }
            };
        }

        #endregion
    }
}
