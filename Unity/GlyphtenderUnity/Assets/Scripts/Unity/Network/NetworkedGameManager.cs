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
            if (SettingsManager.Instance?.PlayMode == PlayMode.Online1v1)
            {
                IsOnlineGame = true;
                LocalPlayer = NetworkManager.Singleton?.IsHost == true ? Player.Yellow : Player.Blue;
                Debug.Log($"[NetworkedGameManager] Online game started. Local player: {LocalPlayer}");

                // If host, broadcast initial game state
                if (NetworkManager.Singleton?.IsHost == true)
                {
                    BroadcastInitialGameState();
                }
            }
            else
            {
                IsOnlineGame = false;
            }
        }

        /// <summary>
        /// Host broadcasts the initial game state to the client.
        /// </summary>
        private void BroadcastInitialGameState()
        {
            if (!NetworkManager.Singleton?.IsHost == true) return;
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
            // TODO: Apply the game state (tile bag order, hands) to match host
            Debug.Log($"[NetworkedGameManager] Received game start: TileBag={gameStart.TileBagOrder.Length} chars");
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

            Debug.Log($"[NetworkedGameManager] Draft placement confirmed at ({placement.Position.Column},{placement.Position.Row})");

            // TODO: Apply draft placement to GameManager
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
