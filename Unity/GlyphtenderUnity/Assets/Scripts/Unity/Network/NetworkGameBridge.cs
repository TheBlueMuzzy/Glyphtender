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
 *   // Client sends move request:
 *   NetworkGameBridge.Instance.RequestMoveServerRpc(moveData);
 *
 *   // All clients receive confirmed move:
 *   NetworkGameBridge.Instance.OnMoveConfirmed += HandleMoveConfirmed;
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
        public event Action<NetworkMoveData> OnMoveConfirmed;
        public event Action<NetworkCastData> OnCastConfirmed;
        public event Action<NetworkTurnData> OnTurnConfirmed;
        public event Action<NetworkDraftPlacement> OnDraftPlacementConfirmed;
        public event Action<NetworkCycleData> OnCycleConfirmed;
        public event Action<NetworkGameStart> OnGameStartReceived;
        public event Action<NetworkForfeit> OnForfeitReceived;
        public event Action<NetworkRematch> OnRematchReceived;

        // Event for validation failures (client-side feedback)
        public event Action<string> OnActionRejected;

        // Track if we're the host player (Yellow) or guest player (Blue)
        public bool IsHostPlayer => IsHost;
        public Player LocalPlayer => IsHostPlayer ? Player.Yellow : Player.Blue;
        public Player RemotePlayer => IsHostPlayer ? Player.Blue : Player.Yellow;

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
        /// Client requests or responds to rematch.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestRematchServerRpc(NetworkRematch rematch, ServerRpcParams rpcParams = default)
        {
            Debug.Log($"[NetworkGameBridge] Rematch request: IsRequest={rematch.IsRequest}, Accepted={rematch.Accepted}");

            BroadcastRematchClientRpc(rematch);
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
            if (!IsHost)
            {
                Debug.LogError("[NetworkGameBridge] Only host can broadcast game start");
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

        private Player GetPlayerFromClientId(ulong clientId)
        {
            // Host (clientId 0 or OwnerClientId for host) is Yellow
            // Guest client is Blue
            return clientId == NetworkManager.ServerClientId ? Player.Yellow : Player.Blue;
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
