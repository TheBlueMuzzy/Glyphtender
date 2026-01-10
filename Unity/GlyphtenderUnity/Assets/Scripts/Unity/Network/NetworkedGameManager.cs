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
using System.Collections;
using System.Collections.Generic;
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

        // Track when we're waiting for our own turn/draft/cycle to come back from network
        // This is more reliable than checking glyphling position which can have race conditions
        private bool _awaitingOwnTurnConfirmation;
        private bool _awaitingOwnDraftConfirmation;
        private bool _awaitingOwnCycleConfirmation;

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
                    var currentDrafter = GameManager.Instance.GameState.CurrentDrafter;
                    bool result = currentDrafter == LocalPlayer;
                    // Debug logging for draft turn check
                    if (!result)
                    {
                        Debug.Log($"[NetworkedGameManager] IsLocalPlayerTurn (Draft): false. CurrentDrafter={currentDrafter}, LocalPlayer={LocalPlayer}");
                    }
                    return result;
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

        private void Update()
        {
            // Retry subscription if it failed during Start
            if (!_subscribedToNetworkEvents)
            {
                SubscribeToNetworkEvents();
            }
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

        private bool _subscribedToNetworkEvents = false;

        private void SubscribeToNetworkEvents()
        {
            if (_subscribedToNetworkEvents) return;
            if (NetworkGameBridge.Instance == null)
            {
                Debug.LogWarning("[NetworkedGameManager] NetworkGameBridge.Instance is null, will retry subscription");
                return;
            }

            NetworkGameBridge.Instance.OnTurnConfirmed += OnNetworkTurnConfirmed;
            NetworkGameBridge.Instance.OnDraftPlacementConfirmed += OnNetworkDraftPlacementConfirmed;
            NetworkGameBridge.Instance.OnCycleConfirmed += OnNetworkCycleConfirmed;
            NetworkGameBridge.Instance.OnGameStartReceived += OnNetworkGameStartReceived;
            NetworkGameBridge.Instance.OnForfeitReceived += OnNetworkForfeitReceived;
            NetworkGameBridge.Instance.OnRematchStatusReceived += OnNetworkRematchStatusReceived;
            _subscribedToNetworkEvents = true;
            Debug.Log("[NetworkedGameManager] Subscribed to network events");
        }

        private void UnsubscribeFromNetworkEvents()
        {
            if (NetworkGameBridge.Instance == null) return;

            NetworkGameBridge.Instance.OnTurnConfirmed -= OnNetworkTurnConfirmed;
            NetworkGameBridge.Instance.OnDraftPlacementConfirmed -= OnNetworkDraftPlacementConfirmed;
            NetworkGameBridge.Instance.OnCycleConfirmed -= OnNetworkCycleConfirmed;
            NetworkGameBridge.Instance.OnGameStartReceived -= OnNetworkGameStartReceived;
            NetworkGameBridge.Instance.OnForfeitReceived -= OnNetworkForfeitReceived;
            NetworkGameBridge.Instance.OnRematchStatusReceived -= OnNetworkRematchStatusReceived;
        }

        private void OnGameInitialized()
        {
            // Check if this is an online game
            // Check multiple sources since SettingsManager might not be set yet
            var playMode = SettingsManager.Instance?.PlayMode;

            // Also check if we have an active network session as a backup indicator
            bool hasNetworkSession = GlyphtenderLobby.Instance?.CurrentLobby != null ||
                                     GlyphtenderRelay.Instance?.State == RelayState.Connected;

            Debug.Log($"[NetworkedGameManager] OnGameInitialized called. PlayMode={playMode}, HasNetworkSession={hasNetworkSession}, IsOnlineGame={IsOnlineGame}");

            // Consider it online if either PlayMode says so OR we have an active network session
            if (playMode == PlayMode.Online1v1 || hasNetworkSession)
            {
                // Check if this is a rematch (already online, just restarting)
                bool isRematch = IsOnlineGame;
                IsOnlineGame = true;

                // Reset awaiting flags for new game/rematch
                _awaitingOwnTurnConfirmation = false;
                _awaitingOwnDraftConfirmation = false;
                _awaitingOwnCycleConfirmation = false;

                // Determine if we're host or guest
                // For rematch, use NetworkManager.IsHost as primary (most stable during active session)
                // For new game, use GlyphtenderLobby.IsHost
                bool isHost = false;
                var netManager = global::Unity.Netcode.NetworkManager.Singleton;

                if (isRematch && netManager != null && netManager.IsListening)
                {
                    // During rematch, NetworkManager.IsHost is the authoritative source
                    isHost = netManager.IsHost;
                    Debug.Log($"[NetworkedGameManager] REMATCH: Using NetworkManager.IsHost = {isHost}");
                }
                else if (GlyphtenderLobby.Instance != null)
                {
                    // New game: Check GlyphtenderLobby (set when creating/joining lobby)
                    isHost = GlyphtenderLobby.Instance.IsHost;
                    Debug.Log($"[NetworkedGameManager] GlyphtenderLobby.IsHost = {isHost}");
                }
                else if (GlyphtenderRelay.Instance != null)
                {
                    // Fallback: Check GlyphtenderRelay (set during allocation/join)
                    isHost = GlyphtenderRelay.Instance.IsHost;
                    Debug.Log($"[NetworkedGameManager] Using GlyphtenderRelay.IsHost = {isHost}");
                }

                // Debug: log all sources for comparison
                if (netManager != null)
                {
                    Debug.Log($"[NetworkedGameManager] NetworkManager state: IsHost={netManager.IsHost}, IsClient={netManager.IsClient}, IsServer={netManager.IsServer}, IsListening={netManager.IsListening}");
                }

                // Determine LocalPlayer from client ID (0=Yellow, 1=Blue, 2=Purple, 3=Pink)
                if (netManager != null && netManager.IsClient)
                {
                    LocalPlayer = GetPlayerFromClientId(netManager.LocalClientId);
                }
                else
                {
                    // Fallback for edge cases
                    LocalPlayer = isHost ? Player.Yellow : Player.Blue;
                }
                Debug.Log($"[NetworkedGameManager] Online game started. isHost={isHost}, LocalPlayer={LocalPlayer}, isRematch={isRematch}");

                // Log draft state for debugging
                if (GameManager.Instance?.GameState?.Phase == GamePhase.Draft)
                {
                    var drafter = GameManager.Instance.GameState.CurrentDrafter;
                    Debug.Log($"[NetworkedGameManager] Draft phase. CurrentDrafter={drafter}, IsLocalPlayerTurn={drafter == LocalPlayer}");
                }

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
        /// Host broadcasts the initial game state to all clients.
        /// Supports 2, 3, or 4 player games.
        /// </summary>
        private void BroadcastInitialGameState()
        {
            // Use GlyphtenderLobby.IsHost since NetworkManager.IsHost may not be ready
            bool isHost = GlyphtenderLobby.Instance?.IsHost ?? false;
            if (!isHost) return;
            if (GameManager.Instance?.GameState == null) return;

            var gameState = GameManager.Instance.GameState;
            int playerCount = gameState.PlayerCount;

            // Build tile bag string
            string tileBag = new string(gameState.TileBag.ToArray());

            // Build hand strings for all active players
            string yellowHand = new string(gameState.Hands[Player.Yellow].ToArray());
            string blueHand = new string(gameState.Hands[Player.Blue].ToArray());
            string purpleHand = playerCount >= 3 ? new string(gameState.Hands[Player.Purple].ToArray()) : "";
            string pinkHand = playerCount >= 4 ? new string(gameState.Hands[Player.Pink].ToArray()) : "";

            var gameStart = new NetworkGameStart
            {
                TileBagOrder = tileBag,
                YellowHand = yellowHand,
                BlueHand = blueHand,
                PurpleHand = purpleHand,
                PinkHand = pinkHand,
                BoardSizeIndex = SettingsManager.Instance?.BoardSizeIndex ?? 1,
                Allow2LetterWords = SettingsManager.Instance?.Allow2LetterWords ?? true,
                PlayerCount = playerCount
            };

            NetworkGameBridge.Instance?.BroadcastGameStart(gameStart);
            Debug.Log($"[NetworkedGameManager] Broadcast initial game state to {playerCount} players");
        }

        #region Network Event Handlers

        private void OnNetworkGameStartReceived(NetworkGameStart gameStart)
        {
            // Client receives initial game state from host
            int playerCount = gameStart.PlayerCount > 0 ? gameStart.PlayerCount : 2;  // Default to 2 for backward compat
            Debug.Log($"[NetworkedGameManager] Received game start: TileBag={gameStart.TileBagOrder.Length} chars, PlayerCount={playerCount}");

            if (GameManager.Instance?.GameState == null)
            {
                Debug.LogWarning("[NetworkedGameManager] GameState is null, cannot apply network game start");
                return;
            }

            var state = GameManager.Instance.GameState;

            // Apply tile bag from host (so all clients draw in same order)
            state.TileBag.Clear();
            string tileBagStr = gameStart.TileBagOrder.ToString();
            for (int i = 0; i < tileBagStr.Length; i++)
            {
                state.TileBag.Add(tileBagStr[i]);
            }

            // Apply hands from host for all active players
            ApplyHandFromNetwork(state, Player.Yellow, gameStart.YellowHand.ToString());
            ApplyHandFromNetwork(state, Player.Blue, gameStart.BlueHand.ToString());

            if (playerCount >= 3)
            {
                ApplyHandFromNetwork(state, Player.Purple, gameStart.PurpleHand.ToString());
            }
            if (playerCount >= 4)
            {
                ApplyHandFromNetwork(state, Player.Pink, gameStart.PinkHand.ToString());
            }

            Debug.Log($"[NetworkedGameManager] Applied game state: TileBag={state.TileBag.Count}, Players={playerCount}");

            // Refresh the hand display to show the correct hand
            if (HandController.Instance != null)
            {
                HandController.Instance.RefreshHand();
            }
        }

        /// <summary>
        /// Helper to apply a hand from network data.
        /// </summary>
        private void ApplyHandFromNetwork(GameState state, Player player, string handStr)
        {
            state.Hands[player].Clear();
            for (int i = 0; i < handStr.Length; i++)
            {
                state.Hands[player].Add(handStr[i]);
            }
        }

        private void OnNetworkTurnConfirmed(NetworkTurnData turnData)
        {
            Debug.Log($"[NetworkedGameManager] OnNetworkTurnConfirmed EVENT FIRED! IsOnlineGame={IsOnlineGame}");

            if (!IsOnlineGame) return;

            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;

            // DIAGNOSTIC: Log current state when turn is received
            Debug.Log($"[NetworkedGameManager] TURN RECEIVED - CurrentPlayer={state.CurrentPlayer}, LocalPlayer={LocalPlayer}, Phase={state.Phase}");

            // Get the glyphling
            if (turnData.Move.GlyphlingIndex < 0 || turnData.Move.GlyphlingIndex >= state.Glyphlings.Count)
            {
                Debug.LogError($"[NetworkedGameManager] Invalid glyphling index: {turnData.Move.GlyphlingIndex}");
                return;
            }

            var glyphling = state.Glyphlings[turnData.Move.GlyphlingIndex];
            var toCoord = turnData.Move.To.ToHexCoord();

            // DIAGNOSTIC: Log glyphling info
            Debug.Log($"[NetworkedGameManager] Glyphling: index={turnData.Move.GlyphlingIndex}, owner={glyphling.Owner}, pos={glyphling.Position}, dest={toCoord}");

            // Use the awaiting flag to determine if this is our own turn coming back
            // This is more reliable than checking glyphling position which can have race conditions
            bool isOwnTurn = _awaitingOwnTurnConfirmation;

            Debug.Log($"[NetworkedGameManager] isOwnTurn={isOwnTurn} (using _awaitingOwnTurnConfirmation flag)");

            if (isOwnTurn)
            {
                // Clear the flag now that we've received our confirmation
                _awaitingOwnTurnConfirmation = false;

                Debug.Log($"[NetworkedGameManager] Own turn path - CurrentPlayer={state.CurrentPlayer}");
                // Apply tile placement and scoring without animation (glyphling already moved)
                ApplyTurnWithoutAnimation(turnData);
                return;
            }

            Debug.Log($"[NetworkedGameManager] Remote turn path - animating for CurrentPlayer={state.CurrentPlayer}");
            // Start coroutine to animate the opponent's turn sequentially (like AI does)
            StartCoroutine(AnimateNetworkTurn(turnData, glyphling));
        }

        /// <summary>
        /// Applies a turn without animation (for when it's our own turn coming back from network).
        /// The glyphling is already at destination, we just need to place tile and handle scoring.
        /// </summary>
        private void ApplyTurnWithoutAnimation(NetworkTurnData turnData)
        {
            var state = GameManager.Instance.GameState;
            var toCoord = turnData.Move.To.ToHexCoord();
            var castCoord = turnData.Cast.Position.ToHexCoord();
            char letter = turnData.Cast.GetLetter();
            Player currentPlayer = state.CurrentPlayer;

            // Set cast origin for tile animation
            GameManager.Instance.SetLastCastOrigin(toCoord);

            // Place tile and remove from hand
            state.Hands[currentPlayer].Remove(letter);
            state.Tiles[castCoord] = new Tile(letter, currentPlayer, castCoord);

            // Score words
            var newWords = GameManager.Instance.WordScorer.FindWordsAt(state, castCoord, letter);
            int turnScore = 0;
            foreach (var word in newWords)
            {
                int wordScore = Core.WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, state, currentPlayer);
                turnScore += wordScore;
            }
            state.Scores[currentPlayer] += turnScore;

            // Track words formed
            GameManager.Instance.LastTurnWordCount = newWords.Count;

            // If no words formed, enter cycle mode
            if (newWords.Count == 0)
            {
                Debug.Log($"[NetworkedGameManager] Own turn: No words formed - entering cycle mode for {currentPlayer} (state.CurrentPlayer was {state.CurrentPlayer})");
                GameManager.Instance.EnterCycleModeFromNetwork(currentPlayer);

                if (BoardRenderer.Instance != null)
                {
                    BoardRenderer.Instance.RefreshBoard();
                    BoardRenderer.Instance.RefreshHighlights();
                }

                if (HandController.Instance != null)
                {
                    HandController.Instance.RefreshHand();
                }
                return;
            }

            // Draw new tile
            GameRules.DrawTile(state, currentPlayer);

            // Check for tangles and end game if needed
            if (TangleChecker.ShouldEndGame(state))
            {
                Debug.Log($"[NetworkedGameManager] Own turn: Tangle detected - ending game");
                GameManager.Instance.EndGame();
                return;
            }

            GameRules.EndTurn(state);

            Debug.Log($"[NetworkedGameManager] Own turn applied. NewCurrentPlayer: {state.CurrentPlayer}");

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

            GameManager.Instance.NotifyNetworkTurnComplete();
        }

        /// <summary>
        /// Animates a network turn with proper timing (move, then cast, then score).
        /// Similar to AIController.ExecuteMoveAnimated to create a consistent experience.
        /// </summary>
        private IEnumerator AnimateNetworkTurn(NetworkTurnData turnData, Glyphling glyphling)
        {
            var state = GameManager.Instance.GameState;
            var toCoord = turnData.Move.To.ToHexCoord();
            var castCoord = turnData.Cast.Position.ToHexCoord();
            char letter = turnData.Cast.GetLetter();
            Player currentPlayer = state.CurrentPlayer;

            Debug.Log($"[NetworkedGameManager] Animating turn: Glyphling {turnData.Move.GlyphlingIndex} ({glyphling.Owner}) to {toCoord}, cast '{letter}' at {castCoord}");

            // Step 1: Move the glyphling
            glyphling.Position = toCoord;

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
            }

            // Wait for move animation to complete
            yield return new WaitForSeconds(0.6f);

            // Step 2: Place the tile
            GameManager.Instance.SetLastCastOrigin(toCoord);
            state.Hands[currentPlayer].Remove(letter);
            state.Tiles[castCoord] = new Tile(letter, currentPlayer, castCoord);

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
            }

            // Wait for tile placement to be visible
            yield return new WaitForSeconds(0.5f);

            // Step 3: Score words and show highlights
            var newWords = GameManager.Instance.WordScorer.FindWordsAt(state, castCoord, letter);
            int turnScore = 0;
            foreach (var word in newWords)
            {
                int wordScore = Core.WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, state, currentPlayer);
                turnScore += wordScore;
            }

            // Track words formed
            GameManager.Instance.LastTurnWordCount = newWords.Count;

            // Show score preview and word highlights if words were formed
            if (newWords.Count > 0 && turnScore > 0)
            {
                if (ScoreDisplay.Instance != null)
                {
                    ScoreDisplay.Instance.ShowPreview(turnScore);
                }

                if (WordHighlighter.Instance != null)
                {
                    WordHighlighter.Instance.HighlightWordsAt(castCoord, letter);
                }

                yield return new WaitForSeconds(1.0f);

                // Clear highlights
                if (WordHighlighter.Instance != null)
                {
                    WordHighlighter.Instance.ClearHighlights();
                }
            }

            // Apply score
            state.Scores[currentPlayer] += turnScore;

            // If no words formed, enter cycle mode instead of ending turn
            if (newWords.Count == 0)
            {
                Debug.Log($"[NetworkedGameManager] Remote turn: No words formed - entering cycle mode for {currentPlayer} (state.CurrentPlayer is {state.CurrentPlayer})");

                // Enter cycle mode through GameManager so UI updates properly
                GameManager.Instance.EnterCycleModeFromNetwork(currentPlayer);

                // Refresh visuals but DON'T end turn yet
                if (BoardRenderer.Instance != null)
                {
                    BoardRenderer.Instance.RefreshBoard();
                    BoardRenderer.Instance.RefreshHighlights();
                }

                if (HandController.Instance != null)
                {
                    HandController.Instance.RefreshHand();
                }

                // Don't fire NotifyNetworkTurnComplete - turn isn't complete yet
                yield break;
            }

            // Step 4: Draw new tile
            GameRules.DrawTile(state, currentPlayer);

            // Check for tangles and end game if needed
            if (TangleChecker.ShouldEndGame(state))
            {
                Debug.Log($"[NetworkedGameManager] Opponent turn: Tangle detected - ending game");
                GameManager.Instance.EndGame();
                yield break;
            }

            Player playerBeforeEndTurn = state.CurrentPlayer;
            GameRules.EndTurn(state);

            Debug.Log($"[NetworkedGameManager] Turn applied. PlayerBefore: {playerBeforeEndTurn}, NewCurrentPlayer: {state.CurrentPlayer}");

            yield return new WaitForSeconds(0.3f);

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

            // Fire events through GameManager so all subscribers update
            GameManager.Instance.NotifyNetworkTurnComplete();
        }

        private void OnNetworkDraftPlacementConfirmed(NetworkDraftPlacement placement)
        {
            if (!IsOnlineGame) return;

            var pos = placement.Position.ToHexCoord();
            int glyphlingIndex = placement.GlyphlingIndex;
            Debug.Log($"[NetworkedGameManager] Draft placement confirmed at ({pos.Column},{pos.Row}), glyphlingIndex={glyphlingIndex}");

            // Apply draft placement to GameManager
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;

            // Use the awaiting flag to determine if this is our own placement coming back
            // Also keep the HasGlyphling check as a safety fallback
            bool isOwnPlacement = _awaitingOwnDraftConfirmation || state.HasGlyphling(pos);
            if (isOwnPlacement)
            {
                _awaitingOwnDraftConfirmation = false;
                Debug.Log($"[NetworkedGameManager] Own draft placement - skipping (already processed locally)");
                return;
            }

            // Only apply if we're in draft phase
            if (state.Phase != GamePhase.Draft)
            {
                Debug.LogWarning("[NetworkedGameManager] Received draft placement but not in draft phase");
                return;
            }

            // Get the specific glyphling being placed by index
            if (glyphlingIndex < 0 || glyphlingIndex >= state.Glyphlings.Count)
            {
                Debug.LogError($"[NetworkedGameManager] Invalid glyphling index: {glyphlingIndex}");
                return;
            }
            var glyphlingToPlace = state.Glyphlings[glyphlingIndex];

            // Apply the placement with the specific glyphling (critical for sync!)
            bool success = GameRules.PlaceDraftGlyphling(state, pos, glyphlingToPlace);
            if (!success)
            {
                Debug.LogError($"[NetworkedGameManager] Failed to place draft glyphling at {pos}");
                return;
            }

            bool draftComplete = state.Phase == GamePhase.Play;
            Debug.Log($"[NetworkedGameManager] Applied draft placement. Phase now: {state.Phase}, CurrentPlayer: {state.CurrentPlayer}, DraftComplete: {draftComplete}");

            // Note: Host applies draft placements locally in GameManager.ConfirmDraftPlacement,
            // so this code path is only hit by the CLIENT receiving the other player's placement.
            // The client doesn't have a ghost to confirm - it just creates a new object in RefreshBoard.

            // Notify GameManager to fire appropriate events (this updates all subscribers)
            GameManager.Instance.NotifyNetworkDraftPlacement(draftComplete);

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
        }

        private void OnNetworkCycleConfirmed(NetworkCycleData cycleData)
        {
            if (!IsOnlineGame) return;

            // Clear the flag if we were awaiting our own cycle
            bool wasOwnCycle = _awaitingOwnCycleConfirmation;
            _awaitingOwnCycleConfirmation = false;

            Debug.Log($"[NetworkedGameManager] Cycle confirmed with mask {cycleData.DiscardMask} (wasOwnCycle={wasOwnCycle})");

            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;
            Player currentPlayer = state.CurrentPlayer;
            var hand = state.Hands[currentPlayer];

            // Apply discards based on mask
            // Build list of tiles to discard (by index, highest first so removal doesn't shift indices)
            var indicesToDiscard = new List<int>();
            for (int i = 0; i < 8; i++)
            {
                if ((cycleData.DiscardMask & (1 << i)) != 0)
                {
                    indicesToDiscard.Add(i);
                }
            }

            // Sort descending so we remove from end first
            indicesToDiscard.Sort((a, b) => b.CompareTo(a));

            foreach (int index in indicesToDiscard)
            {
                if (index < hand.Count)
                {
                    Debug.Log($"[NetworkedGameManager] Discarding tile at index {index}: '{hand[index]}'");
                    hand.RemoveAt(index);
                }
            }

            // Draw new tiles to refill hand
            while (hand.Count < GameRules.HandSize && state.TileBag.Count > 0)
            {
                GameRules.DrawTile(state, currentPlayer);
            }

            // Check for tangles and end game if needed
            if (TangleChecker.ShouldEndGame(state))
            {
                Debug.Log($"[NetworkedGameManager] Cycle: Tangle detected - ending game");
                GameManager.Instance.ExitCycleModeFromNetwork();
                GameManager.Instance.EndGame();
                return;
            }

            // Now end the turn
            GameRules.EndTurn(state);

            Debug.Log($"[NetworkedGameManager] Cycle applied, turn ended. New CurrentPlayer: {state.CurrentPlayer}");

            // Exit cycle mode in GameManager
            GameManager.Instance.ExitCycleModeFromNetwork();

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

            // Fire events through GameManager so all subscribers update
            GameManager.Instance.NotifyNetworkTurnComplete();
        }

        private void OnNetworkForfeitReceived(NetworkForfeit forfeit)
        {
            if (!IsOnlineGame) return;

            Debug.Log($"[NetworkedGameManager] {forfeit.GetPlayer()} forfeited");

            // TODO: Handle forfeit - end game, show message, maybe AI takeover option
        }

        private void OnNetworkRematchStatusReceived(NetworkRematchStatus status)
        {
            Debug.Log($"[NetworkedGameManager] Rematch status received: {status.GetPlayer()} = {status.GetStatus()}");

            // Update local RematchManager with received status
            if (RematchManager.Instance != null)
            {
                RematchManager.Instance.SetPlayerStatus(status.GetPlayer(), status.GetStatus());

                // If timer info included and timer not yet active locally, sync it
                // BUT don't sync if the game already restarted (SetPlayerStatus may have triggered rematch completion)
                // Check CurrentTurnState - if not GameOver, the new game already started
                bool gameRestarted = GameManager.Instance?.CurrentTurnState != GameTurnState.GameOver;
                if (status.TimerStartTime > 0 && !RematchManager.Instance.IsTimerActive && !gameRestarted)
                {
                    RematchManager.Instance.SyncTimer(status.TimerStartTime, status.TimerDuration);
                }
            }
        }

        #endregion

        #region Helper Methods

        /// <summary>
        /// Maps client ID to Player enum.
        /// Client IDs are assigned in join order: 0=Yellow, 1=Blue, 2=Purple, 3=Pink
        /// </summary>
        private Player GetPlayerFromClientId(ulong clientId)
        {
            int playerIndex = (int)System.Math.Min(clientId, 3);  // Clamp to valid range
            return (Player)playerIndex;
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
            Debug.Log($"[NetworkedGameManager] ========== SendTurnToNetwork ==========");
            Debug.Log($"[NetworkedGameManager] from={moveFrom}, to={moveTo}, cast={castPosition}, letter={letter}, glyphling={glyphlingIndex}");

            if (!IsOnlineGame)
            {
                Debug.LogWarning("[NetworkedGameManager] SendTurnToNetwork: Not online game, skipping");
                return;
            }
            if (NetworkGameBridge.Instance == null)
            {
                Debug.LogError("[NetworkedGameManager] SendTurnToNetwork: NetworkGameBridge.Instance is null!");
                return;
            }

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

            // Set flag BEFORE sending so we know the confirmation is ours
            _awaitingOwnTurnConfirmation = true;

            Debug.Log($"[NetworkedGameManager] Calling RequestTurnServerRpc... (awaiting confirmation)");
            NetworkGameBridge.Instance.RequestTurnServerRpc(turnData);
            Debug.Log($"[NetworkedGameManager] RequestTurnServerRpc called successfully");
        }

        /// <summary>
        /// Sends a draft placement to the host for validation.
        /// </summary>
        public void SendDraftPlacementToNetwork(HexCoord position, int glyphlingIndex)
        {
            if (!IsOnlineGame) return;
            if (NetworkGameBridge.Instance == null) return;

            var placement = new NetworkDraftPlacement
            {
                Position = new NetworkHexCoord(position),
                GlyphlingIndex = glyphlingIndex
            };

            // Set flag BEFORE sending so we know the confirmation is ours
            _awaitingOwnDraftConfirmation = true;

            Debug.Log($"[NetworkedGameManager] Sending draft placement: pos={position}, glyphlingIndex={glyphlingIndex} (awaiting confirmation)");
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

            // Set flag BEFORE sending so we know the confirmation is ours
            _awaitingOwnCycleConfirmation = true;

            Debug.Log($"[NetworkedGameManager] Sending cycle: mask={discardMask} (awaiting confirmation)");
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
