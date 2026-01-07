using UnityEngine;
using Unity.Netcode;
using Glyphtender.Core;
using Glyphtender.Core.Stats;
using Glyphtender.Unity.Stats;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Represents the current phase of a player's turn.
    /// </summary>
    public enum GameTurnState
    {
        Idle,              // Waiting for player to select a glyphling
        GlyphlingSelected, // Glyphling chosen, showing valid moves
        MovePending,       // Destination chosen, selecting cast position and/or letter
        ReadyToConfirm,    // Both cast position and letter selected
        CycleMode,         // No word formed, selecting tiles to discard
        DraftPlacement,    // Draft phase - waiting for player to place glyphling
        GameOver           // Game has ended
    }

    /// <summary>
    /// Central game controller. Manages game state, turns, and coordinates
    /// between input, rendering, and game logic.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        // Core game objects
        public GameState GameState { get; private set; }
        public WordScorer WordScorer { get; private set; }

        // Current turn state
        public Glyphling SelectedGlyphling { get; private set; }
        public HexCoord? PendingDestination { get; private set; }
        public HexCoord? PendingCastPosition { get; private set; }
        private HexCoord? _originalPosition;
        public bool IsResetting { get; set; }
        public HexCoord? LastCastOrigin { get; private set; }
        public char? PendingLetter { get; private set; }
        // Draft phase tracking
        public HexCoord? PendingDraftPosition { get; private set; }
        public Glyphling SelectedDraftGlyphling { get; private set; }
        private AIManager _aiManager;
        public AIManager AIManager => _aiManager;

        public bool IsInCycleMode => CurrentTurnState == GameTurnState.CycleMode;
        public bool IsCurrentPlayerAI => _aiManager != null && _aiManager.IsPlayerAI(GameState.CurrentPlayer);
        public GameTurnState CurrentTurnState { get; private set; } = GameTurnState.Idle;
        public enum InputMode { Tap, Drag }
        public InputMode CurrentInputMode { get; private set; } = InputMode.Drag;

        public void SetInputMode(InputMode mode)
        {
            CurrentInputMode = mode;
            OnInputModeChanged?.Invoke();
        }

        public int LastTurnWordCount { get; set; }

        // Valid moves/casts for current selection
        public List<HexCoord> ValidMoves { get; private set; }
        public List<HexCoord> ValidCasts { get; private set; }
        public List<HexCoord> ValidDraftPlacements { get; private set; }

        // Cycle mode tracking for stats
        private int _tilesCycledThisTurn;
        private bool _enteredCycleMode;
        private Player _cycleModeTurnPlayer;
        private List<WordResult> _lastTurnWords;
        private int _lastTurnScore;

        // Main menu gate - when true, game waits for MainMenuScreen to call InitializeGame
        public bool WaitingForMainMenu { get; set; } = true;

        // Events for UI/rendering updates
        public event System.Action OnGameStateChanged;
        public event System.Action OnSelectionChanged;
        public event System.Action OnTurnEnded;
        public event System.Action<Player?> OnGameEnded;
        public event System.Action OnGameRestarted;
        public event System.Action OnGameInitialized;
        public event System.Action OnInputModeChanged;
        public event System.Action<GameTurnState> OnTurnStateChanged;
        public event System.Action OnDraftComplete;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            ValidMoves = new List<HexCoord>();
            ValidCasts = new List<HexCoord>();
            ValidDraftPlacements = new List<HexCoord>();
        }

        private void Start()
        {
            // If waiting for main menu, don't initialize yet
            if (WaitingForMainMenu)
            {
                return;
            }

            InitializeGame();
        }

        public void InitializeGame()
        {
            // Load dictionary (only if not already loaded)
            if (WordScorer == null)
            {
                WordScorer = new WordScorer();
                LoadDictionary();
            }

            // Apply minimum word length setting
            if (SettingsManager.Instance != null)
            {
                WordScorer.MinimumWordLength = SettingsManager.Instance.Allow2LetterWords ? 2 : 3;
            }

            // Get board size from settings
            BoardSize boardSize = BoardSize.Small;
            if (SettingsManager.Instance != null)
            {
                boardSize = (BoardSize)SettingsManager.Instance.BoardSizeIndex;
            }

            // Get player count from play mode
            int playerCount = 2;
            if (SettingsManager.Instance != null)
            {
                switch (SettingsManager.Instance.PlayMode)
                {
                    case PlayMode.Local3P:
                        playerCount = 3;
                        break;
                    case PlayMode.Local4P:
                        playerCount = 4;
                        break;
                    default:
                        playerCount = 2;
                        break;
                }
            }

            // Create new game with selected board size and player count
            GameState = GameRules.CreateNewGameWithDraft(boardSize, playerCount);

            // If draft mode, set up draft state and return early
            if (GameState.Phase == GamePhase.Draft)
            {

                ValidDraftPlacements = GameRules.GetValidDraftPlacements(GameState);

                _aiManager = FindObjectOfType<AIManager>();
                if (_aiManager == null)
                {
                    var aiManagerObj = new GameObject("AIManager");
                    _aiManager = aiManagerObj.AddComponent<AIManager>();
                }
                _aiManager.Initialize(WordScorer);
                _aiManager.ResetForNewGame();

                UpdateTurnState();
                OnGameStateChanged?.Invoke();
                OnGameRestarted?.Invoke();
                WaitingForMainMenu = false;
                OnGameInitialized?.Invoke();

                // Check if first drafter is AI
                var drafterAI = _aiManager.GetAIForPlayer(GameState.CurrentDrafter);
                if (drafterAI != null)
                {
                    drafterAI.TakeDraftTurn(GameState, ValidDraftPlacements);
                }
                return;
            }

            // Reset all state
            LastTurnWordCount = 0;
            _originalPosition = null;
            _tilesCycledThisTurn = 0;
            _enteredCycleMode = false;
            _lastTurnWords = null;
            _lastTurnScore = 0;

            ClearSelection();
            UpdateTurnState();
            OnGameStateChanged?.Invoke();
            OnGameRestarted?.Invoke();

            // Initialize AI manager
            _aiManager = FindObjectOfType<AIManager>();
            if (_aiManager == null)
            {
                // Create AIManager if it doesn't exist
                var aiManagerObj = new GameObject("AIManager");
                _aiManager = aiManagerObj.AddComponent<AIManager>();
            }
            _aiManager.Initialize(WordScorer);
            _aiManager.ResetForNewGame();

            // Start game history tracking
            StartGameHistory();

            // Check if it's AI's turn at start
            var currentAI = _aiManager.GetAIForPlayer(GameState.CurrentPlayer);
            if (currentAI != null)
            {
                currentAI.TakeTurn(GameState);
            }

            // Notify listeners that game has initialized
            WaitingForMainMenu = false;
            OnGameInitialized?.Invoke();
        }

        /// <summary>
        /// Initializes a new game with draft phase.
        /// </summary>
        public void InitializeGameWithDraft()
        {
            // Load dictionary (only if not already loaded)
            if (WordScorer == null)
            {
                WordScorer = new WordScorer();
                LoadDictionary();
            }

            // Apply minimum word length setting
            if (SettingsManager.Instance != null)
            {
                WordScorer.MinimumWordLength = SettingsManager.Instance.Allow2LetterWords ? 2 : 3;
            }

            // Get board size from settings
            BoardSize boardSize = BoardSize.Small;
            if (SettingsManager.Instance != null)
            {
                boardSize = (BoardSize)SettingsManager.Instance.BoardSizeIndex;
            }

            // Create new game with draft phase
            GameState = GameRules.CreateNewGameWithDraft(boardSize);

            // Reset all state
            LastTurnWordCount = 0;
            _originalPosition = null;
            _tilesCycledThisTurn = 0;
            _enteredCycleMode = false;
            _lastTurnWords = null;
            _lastTurnScore = 0;


            ClearSelection();

            // Calculate initial valid draft placements
            ValidDraftPlacements = GameRules.GetValidDraftPlacements(GameState);

            // Initialize AI manager
            _aiManager = FindObjectOfType<AIManager>();
            if (_aiManager == null)
            {
                var aiManagerObj = new GameObject("AIManager");
                _aiManager = aiManagerObj.AddComponent<AIManager>();
            }
            _aiManager.Initialize(WordScorer);
            _aiManager.ResetForNewGame();

            // Don't start game history yet - wait until draft completes and hands are dealt

            UpdateTurnState();
            OnGameStateChanged?.Invoke();
            OnGameRestarted?.Invoke();

            // Check if first drafter is AI
            var drafterAI = _aiManager.GetAIForPlayer(GameState.CurrentDrafter);
            if (drafterAI != null)
            {
                drafterAI.TakeDraftTurn(GameState, ValidDraftPlacements);
            }

            // Notify listeners
            WaitingForMainMenu = false;
            OnGameInitialized?.Invoke();
        }

        /// <summary>
        /// Starts tracking game history for stats.
        /// </summary>
        private void StartGameHistory()
        {
            if (GameHistoryManager.Instance == null)
            {
                return;
            }

            // Create player info for each active player
            var playerInfos = new List<PlayerInfo>();

            foreach (var player in GameState.ActivePlayers)
            {
                var ai = _aiManager?.GetAIForPlayer(player);
                if (ai != null)
                {
                    playerInfos.Add(PlayerInfo.CreateAI(ai.PersonalityName));
                }
                else
                {
                    playerInfos.Add(PlayerInfo.CreateLocalPlayer("Player"));
                }
            }

            GameHistoryManager.Instance.StartNewGame(playerInfos, GameState);
        }

        private void LoadDictionary()
        {
            TextAsset wordFile = Resources.Load<TextAsset>("words");
            if (wordFile != null)
            {
                string[] words = wordFile.text.Split(new[] { '\r', '\n' },
                    System.StringSplitOptions.RemoveEmptyEntries);
                WordScorer.LoadDictionary(words);
            }
        }

        /// <summary>
        /// Called when player drops a glyphling on a hex during draft phase (preview, not confirmed).
        /// </summary>
        public void SelectDraftPosition(HexCoord position)
        {
            // Only allow during draft phase
            if (GameState.Phase != GamePhase.Draft)
            {
                return;
            }

            // Must have a glyphling selected from hand
            if (SelectedDraftGlyphling == null)
            {
                return;
            }

            // Check if valid placement
            if (!ValidDraftPlacements.Contains(position))
            {
                return;
            }

            PendingDraftPosition = position;

            // Clear highlights while placed (user can still pick up and move)
            ValidDraftPlacements.Clear();

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard(); // Show ghost glyphling
                BoardRenderer.Instance.RefreshHighlights(); // Clear old highlights AFTER board refresh
            }

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();
        }

        /// <summary>
        /// Called when player selects a glyphling from hand during draft phase.
        /// </summary>
        public void SelectDraftGlyphlingFromHand(Glyphling glyphling)
        {
            if (GameState.Phase != GamePhase.Draft)
                return;

            if (glyphling.Owner != GameState.CurrentDrafter)
            {
                return;
            }

            if (glyphling.IsPlaced)
            {
                return;
            }

            SelectedDraftGlyphling = glyphling;
            PendingDraftPosition = null;

            // Show all valid placements
            ValidDraftPlacements = GameRules.GetValidDraftPlacements(GameState);

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshHighlights();
            }

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called when player picks up a pending draft glyphling from the board to reposition it.
        /// </summary>
        public void PickUpPendingDraftGlyphling()
        {
            if (GameState.Phase != GamePhase.Draft)
                return;

            if (PendingDraftPosition == null)
                return;

            PendingDraftPosition = null;

            // Re-show all valid placements
            ValidDraftPlacements = GameRules.GetValidDraftPlacements(GameState);

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshHighlights();
                BoardRenderer.Instance.RefreshBoard();
            }

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Confirms the pending draft placement.
        /// </summary>
        public void ConfirmDraftPlacement()
        {
            if (GameState.Phase != GamePhase.Draft)
                return;

            if (PendingDraftPosition == null || SelectedDraftGlyphling == null)
            {
                return;
            }

            var position = PendingDraftPosition.Value;

            // Check if we're in online mode - we'll send RPC AFTER local processing
            // to avoid race condition where ServerRpc runs synchronously on host
            bool isOnline = NetworkedGameManager.Instance != null &&
                NetworkedGameManager.Instance.IsOnlineGame;

            // Capture the glyphling before placement (for confirming the ghost object)
            var placingGlyphling = SelectedDraftGlyphling;

            // Place the glyphling - pass the specific glyphling to avoid mismatch with ghost
            bool success = GameRules.PlaceDraftGlyphling(GameState, position, placingGlyphling);
            if (!success)
            {
                return;
            }

            // Confirm the ghost object so it becomes the permanent board glyphling
            // This must happen BEFORE RefreshBoard to prevent creating a duplicate
            if (BoardRenderer.Instance != null && placingGlyphling != null)
            {
                BoardRenderer.Instance.ConfirmGhostGlyphling(placingGlyphling);
            }

            // Clear draft selection state
            PendingDraftPosition = null;
            SelectedDraftGlyphling = null;
            ValidDraftPlacements.Clear();

            // Check if draft is complete
            if (GameState.Phase == GamePhase.Play)
            {
                // Draft finished, transition to play

                if (BoardRenderer.Instance != null)
                {
                    BoardRenderer.Instance.RefreshHighlights();
                    BoardRenderer.Instance.RefreshBoard();
                }

                // Start game history tracking now that hands are dealt
                StartGameHistory();

                OnDraftComplete?.Invoke();
                OnGameStateChanged?.Invoke();

                // Check if first player is AI
                var currentAI = _aiManager?.GetAIForPlayer(GameState.CurrentPlayer);
                if (currentAI != null)
                {
                    currentAI.TakeTurn(GameState);
                }
            }
            else
            {
                // More picks remaining

                if (BoardRenderer.Instance != null)
                {
                    BoardRenderer.Instance.RefreshHighlights();
                    BoardRenderer.Instance.RefreshBoard();
                }

                // Check if next drafter is AI
                var drafterAI = _aiManager?.GetAIForPlayer(GameState.CurrentDrafter);
                if (drafterAI != null)
                {
                    ValidDraftPlacements = GameRules.GetValidDraftPlacements(GameState);
                    drafterAI.TakeDraftTurn(GameState, ValidDraftPlacements);
                }
            }

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();

            // Send to network AFTER all local processing to avoid race condition
            // (ServerRpc executes synchronously on host, causing RPC callback to run
            // before local code continues, which would make PlaceDraftGlyphling fail)
            if (isOnline)
            {
                NetworkedGameManager.Instance.SendDraftPlacementToNetwork(position);
            }
        }

        /// <summary>
        /// Cancels the current draft placement, returning glyphling to hand.
        /// </summary>
        public void CancelDraftPlacement()
        {
            if (GameState.Phase != GamePhase.Draft)
                return;

            // If there's an external ghost (dragged from hand), destroy it
            // HandController will recreate it on RefreshHand
            if (BoardRenderer.Instance != null)
            {
                var returnedGhost = BoardRenderer.Instance.HideGhostGlyphling();
                if (returnedGhost != null)
                {
                    // Destroy the returned ghost - RefreshDraftHand will create a new one in hand
                    Object.Destroy(returnedGhost);
                }
            }

            PendingDraftPosition = null;
            SelectedDraftGlyphling = null;
            ValidDraftPlacements.Clear();

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshHighlights();
                BoardRenderer.Instance.RefreshBoard();
            }

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called by NetworkedGameManager when a draft placement is received from network.
        /// Fires appropriate events so all subscribers (TurnIndicator, HandController, etc.) update.
        /// </summary>
        public void NotifyNetworkDraftPlacement(bool draftComplete)
        {
            if (draftComplete)
            {
                StartGameHistory();
                OnDraftComplete?.Invoke();
                Debug.Log("[GameManager] NotifyNetworkDraftPlacement: Draft complete, fired OnDraftComplete");
            }

            UpdateTurnState();
            OnGameStateChanged?.Invoke();
            Debug.Log($"[GameManager] NotifyNetworkDraftPlacement: Fired OnGameStateChanged, CurrentPlayer={GameState?.CurrentPlayer}");
        }

        /// <summary>
        /// Called by NetworkedGameManager when a turn is received from network.
        /// Fires appropriate events so all subscribers update.
        /// </summary>
        public void NotifyNetworkTurnComplete()
        {
            UpdateTurnState();
            OnTurnEnded?.Invoke();
            OnGameStateChanged?.Invoke();
            Debug.Log($"[GameManager] NotifyNetworkTurnComplete: CurrentPlayer={GameState?.CurrentPlayer}");
        }

        /// <summary>
        /// Called when player taps/clicks a glyphling.
        /// </summary>
        public void SelectGlyphling(Glyphling glyphling)
        {
            // Block input during AI turn
            if (IsCurrentPlayerAI)
            {
                return;
            }

            // Only allow selection in Idle state (or if re-selecting before confirming)
            if (CurrentTurnState != GameTurnState.Idle &&
                CurrentTurnState != GameTurnState.GlyphlingSelected &&
                CurrentTurnState != GameTurnState.MovePending)
            {
                return;
            }

            // Can only select own glyphlings
            if (glyphling.Owner != GameState.CurrentPlayer)
            {
                return;
            }

            // If we had a pending move, reset the glyphling's position
            if (SelectedGlyphling != null && PendingDestination != null)
            {
                // Find original position and restore it
                // We need to track this - for now, just reset the whole selection
                ResetMove();
            }

            SelectedGlyphling = glyphling;
            PendingDestination = null;
            PendingCastPosition = null;
            PendingLetter = null;

            // Calculate valid moves
            ValidMoves = GameRules.GetValidMoves(GameState, glyphling);
            ValidCasts.Clear();

            // Begin move tracking for stats
            GameHistoryManager.Instance?.BeginMove(glyphling, GameState);

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called when player taps/clicks a hex for movement.
        /// </summary>
        public void SelectDestination(HexCoord destination)
        {
            // Block input during AI turn
            if (IsCurrentPlayerAI)
            {
                return;
            }

            // Only allow destination selection after glyphling is selected
            if (CurrentTurnState != GameTurnState.GlyphlingSelected)
            {
                return;
            }

            if (!ValidMoves.Contains(destination))
            {
                return;
            }

            // Store original position for undo
            _originalPosition = SelectedGlyphling.Position;

            // Move glyphling (preview)
            PendingDestination = destination;
            SelectedGlyphling.Position = destination;

            // Track destination for stats
            GameHistoryManager.Instance?.SetMoveDestination(destination);

            // Calculate valid cast positions from new location
            ValidCasts = GameRules.GetValidCastPositions(GameState, SelectedGlyphling);
            ValidMoves.Clear();

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();
        }

        /// <summary>
        /// Called when player taps/clicks a hex for casting.
        /// </summary>
        public void SelectCastPosition(HexCoord castPosition)
        {
            // Block input during AI turn
            if (IsCurrentPlayerAI)
            {
                return;
            }

            // Only allow cast selection after move is pending
            if (CurrentTurnState != GameTurnState.MovePending &&
                CurrentTurnState != GameTurnState.ReadyToConfirm)
            {
                return;
            }

            if (!ValidCasts.Contains(castPosition))
            {
                return;
            }

            PendingCastPosition = castPosition;
            LastCastOrigin = SelectedGlyphling.Position;


            // If we already have a letter, show ghost and preview words
            if (PendingLetter != null)
            {
                ShowGhostAndPreview();
            }
 
            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called when player selects a letter from their hand.
        /// </summary>
        public void SelectLetter(char letter)
        {
            // Only allow letter selection after move is pending
            if (CurrentTurnState != GameTurnState.MovePending &&
                CurrentTurnState != GameTurnState.ReadyToConfirm)
            {
                return;
            }

            if (!GameState.Hands[GameState.CurrentPlayer].Contains(letter))
            {
                return;
            }

            PendingLetter = letter;

            // If we already have a cast position, show ghost and preview words
            if (PendingCastPosition != null)
            {
                ShowGhostAndPreview();
            }

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Clears the pending letter selection.
        /// </summary>
        public void ClearPendingLetter()
        {
            PendingLetter = null;
            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Clears the pending cast position selection.
        /// </summary>
        public void ClearPendingCastPosition()
        {
            PendingCastPosition = null;
            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Shows ghost tile and word preview when both cast position and letter are selected.
        /// </summary>
        private void ShowGhostAndPreview()
        {
            // Preview words that would be formed
            var previewWords = WordScorer.FindWordsAt(GameState, PendingCastPosition.Value, PendingLetter.Value);
            int previewScore = 0;
            foreach (var word in previewWords)
            {
                int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, GameState, GameState.CurrentPlayer);
                previewScore += wordScore;
            }

            // Only show ghost tile in tap mode
            if (CurrentInputMode == InputMode.Tap)
            {
                if (BoardRenderer.Instance != null)
                {
                    BoardRenderer.Instance.ShowGhostTile(PendingCastPosition.Value, PendingLetter.Value, GameState.CurrentPlayer);
                }
            }
        }

        /// <summary>
        /// Confirms the current move and ends the turn. [FORCE RECOMPILE]
        /// </summary>
        public void ConfirmMove()
        {
            Debug.Log($"[GameManager] ========== ConfirmMove CALLED ==========");
            Debug.Log($"[GameManager] CurrentTurnState={CurrentTurnState}");

            // Only allow confirm in ReadyToConfirm state
            if (CurrentTurnState != GameTurnState.ReadyToConfirm)
            {
                Debug.Log($"[GameManager] ConfirmMove: REJECTED - not in ReadyToConfirm state");
                return;
            }

            // In online mode, send to network instead of applying locally
            // The NetworkedGameManager will apply when confirmed from host
            bool hasNetManager = NetworkedGameManager.Instance != null;
            bool isOnline = hasNetManager && NetworkedGameManager.Instance.IsOnlineGame;
            Debug.Log($"[GameManager] ConfirmMove: hasNetManager={hasNetManager}, isOnline={isOnline}");

            if (hasNetManager && isOnline)
            {
                Debug.Log("[GameManager] ConfirmMove: Taking network path");
                // Find which glyphling was selected
                int glyphlingIndex = GameState.Glyphlings.IndexOf(SelectedGlyphling);

                // Capture move data before any changes
                HexCoord originalPos = _originalPosition ?? SelectedGlyphling.Position.Value;
                HexCoord destPos = PendingDestination.Value;
                HexCoord castPos = PendingCastPosition.Value;
                char letter = PendingLetter.Value;

                // For HOST: Reset position before RPC because ServerRpc executes synchronously
                // The RPC handler will then process and move it to destination
                // For CLIENT: Keep at destination so "already at destination" check skips animation
                bool isHost = NetworkManager.Singleton != null && NetworkManager.Singleton.IsHost;
                if (isHost && _originalPosition != null && SelectedGlyphling != null)
                {
                    SelectedGlyphling.Position = _originalPosition.Value;
                }
                else if (!isHost && SelectedGlyphling != null)
                {
                    // Client: Set position to destination so we skip animation when RPC returns
                    SelectedGlyphling.Position = destPos;
                }

                NetworkedGameManager.Instance.SendTurnToNetwork(
                    originalPos,
                    destPos,
                    castPos,
                    letter,
                    glyphlingIndex);

                // Hide ghost tile and destroy the returned object (prevents orphaned tiles)
                if (BoardRenderer.Instance != null)
                {
                    var orphanedTile = BoardRenderer.Instance.HideGhostTile();
                    if (orphanedTile != null)
                    {
                        Destroy(orphanedTile);
                    }
                }

                // Remove tile from hand immediately so RefreshHand doesn't re-show it
                // (The network handler will skip this removal since it's already gone)
                GameState.Hands[GameState.CurrentPlayer].Remove(letter);

                // Clear selection state (UI feedback)
                ClearSelection();
                UpdateTurnState();
                OnSelectionChanged?.Invoke();
                OnGameStateChanged?.Invoke();
                return;
            }

            // Store current player before any state changes
            Player currentPlayer = GameState.CurrentPlayer;

            // Place tile in game state
            GameState.Hands[currentPlayer].Remove(PendingLetter.Value);
            var newTile = new Tile(
                PendingLetter.Value,
                currentPlayer,
                PendingCastPosition.Value);
            GameState.Tiles[PendingCastPosition.Value] = newTile;

            // Confirm ghost tile to make it permanent on the board
            // This must happen AFTER the tile is added to GameState.Tiles
            // so RefreshTiles doesn't create a duplicate
            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.ConfirmGhostTile(PendingCastPosition.Value, newTile);
            }

            // Score words formed by the new tile
            var newWords = WordScorer.FindWordsAt(GameState, PendingCastPosition.Value, PendingLetter.Value);
            int turnScore = 0;
            foreach (var word in newWords)
            {
                int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, GameState, currentPlayer);
                turnScore += wordScore;
            }
            GameState.Scores[currentPlayer] += turnScore;

            // Track how many words were formed
            LastTurnWordCount = newWords.Count;

            // Store for stats recording
            _lastTurnWords = newWords;
            _lastTurnScore = turnScore;

            // If no words formed, enter cycle mode instead of ending turn
            if (newWords.Count == 0)
            {
                CurrentTurnState = GameTurnState.CycleMode;
                _enteredCycleMode = true;
                _tilesCycledThisTurn = 0;
                _cycleModeTurnPlayer = currentPlayer;
                ClearSelection();
                OnSelectionChanged?.Invoke();
                OnGameStateChanged?.Invoke();
                return;  // Don't end turn yet, don't draw tile
            }

            // Record move for stats (normal case - words formed)
            RecordMoveForStats(currentPlayer, newWords, turnScore, false, 0);

            // Draw new tile
            GameRules.DrawTile(GameState, currentPlayer);

            // Check for tangles
            var tangled = TangleChecker.GetTangledGlyphlings(GameState);

            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                EndGame();
                return;
            }

            // End turn
            GameRules.EndTurn(GameState);

            ClearSelection();
            UpdateTurnState();
            OnTurnEnded?.Invoke();

            // Check if it's AI's turn
            var currentAI = _aiManager?.GetAIForPlayer(GameState.CurrentPlayer);
            if (currentAI != null)
            {
                currentAI.TakeTurn(GameState);
            }

            OnGameStateChanged?.Invoke();
        }

        /// <summary>
        /// Called when a tile is discarded during cycle mode.
        /// </summary>
        public void OnTileCycled()
        {
            _tilesCycledThisTurn++;
        }

        /// <summary>
        /// Records the move to game history for stats tracking.
        /// </summary>
        private void RecordMoveForStats(Player player, List<WordResult> words, int score, bool cycleMode, int tilesCycled)
        {
            if (GameHistoryManager.Instance == null) return;
            if (PendingCastPosition == null || PendingLetter == null) return;

            GameHistoryManager.Instance.RecordMove(
                GameState,
                player,
                PendingCastPosition.Value,
                PendingLetter.Value,
                words,
                score,
                cycleMode,
                tilesCycled
            );
        }

        /// <summary>
        /// Resets the current move (undo before confirm).
        /// </summary>
        public void ResetMove()
        {
            // Only allow reset when there's something to reset
            if (CurrentTurnState == GameTurnState.Idle ||
                CurrentTurnState == GameTurnState.CycleMode ||
                CurrentTurnState == GameTurnState.GameOver)
            {
                return;
            }

            IsResetting = true;

            // Hide ghost tile
            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.HideGhostTile();
            }

            if (SelectedGlyphling != null && _originalPosition != null)
            {
                SelectedGlyphling.Position = _originalPosition.Value;
            }

            _originalPosition = null;
            ClearSelection();
            UpdateTurnState();
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();

            IsResetting = false;
        }

        /// <summary>
        /// Ends cycle mode and finishes the turn.
        /// </summary>
        public void EndCycleMode()
        {
            // Record move for stats (cycle mode case)
            if (_enteredCycleMode)
            {
                RecordMoveForStats(_cycleModeTurnPlayer, _lastTurnWords, _lastTurnScore, true, _tilesCycledThisTurn);
                _enteredCycleMode = false;
            }

            // Check for tangles
            var tangled = TangleChecker.GetTangledGlyphlings(GameState);


            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                EndGame();
                return;
            }

            // End turn
            GameRules.EndTurn(GameState);

            ClearSelection();
            CurrentTurnState = GameTurnState.Idle;
            UpdateTurnState();
            OnTurnEnded?.Invoke();

            // Check if it's AI's turn
            var currentAI = _aiManager?.GetAIForPlayer(GameState.CurrentPlayer);
            if (currentAI != null)
            {
                currentAI.TakeTurn(GameState);
            }

            OnGameStateChanged?.Invoke();
        }

        /// <summary>
        /// Called by NetworkedGameManager when a network turn results in no words formed.
        /// Enters cycle mode so the player can discard tiles before their turn ends.
        /// </summary>
        public void EnterCycleModeFromNetwork(Player player)
        {
            Debug.Log($"[GameManager] EnterCycleModeFromNetwork for {player}");

            CurrentTurnState = GameTurnState.CycleMode;
            _enteredCycleMode = true;
            _tilesCycledThisTurn = 0;
            _cycleModeTurnPlayer = player;

            ClearSelection();
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();
        }

        /// <summary>
        /// Called by NetworkedGameManager when cycle mode is complete from network.
        /// Exits cycle mode state without ending turn (network handles that).
        /// </summary>
        public void ExitCycleModeFromNetwork()
        {
            Debug.Log("[GameManager] ExitCycleModeFromNetwork");

            _enteredCycleMode = false;
            CurrentTurnState = GameTurnState.Idle;
            ClearSelection();
        }

        /// <summary>
        /// Sets the cast origin for tile animation.
        /// </summary>
        public void SetLastCastOrigin(HexCoord origin)
        {
            LastCastOrigin = origin;
        }

        /// <summary>
        /// Called by AIController when AI completes its turn.
        /// </summary>
        public void OnTurnComplete()
        {
            // Check for tangles
            var tangled = TangleChecker.GetTangledGlyphlings(GameState);


            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                EndGame();
                return;
            }

            ClearSelection();
            UpdateTurnState();
            OnTurnEnded?.Invoke();
            OnGameStateChanged?.Invoke();

            // Check if it's AI's turn (for AI vs AI)
            var currentAI = _aiManager?.GetAIForPlayer(GameState.CurrentPlayer);
            if (currentAI != null)
            {
                currentAI.TakeTurn(GameState);
            }
        }

        /// <summary>
        /// Ends the game, calculates final tangle points, and determines winner.
        /// </summary>
        public void EndGame()
        {
            GameState.IsGameOver = true;

            // Calculate and award tangle points
            var tanglePoints = TangleChecker.CalculateTanglePoints(GameState);
            foreach (var player in GameState.ActivePlayers)
            {
                GameState.Scores[player] += tanglePoints[player];
            }


            // Determine winner (highest score wins)
            Player? winner = null;
            int highestScore = -1;
            bool isTie = false;

            foreach (var player in GameState.ActivePlayers)
            {
                int score = GameState.Scores[player];
                if (score > highestScore)
                {
                    highestScore = score;
                    winner = player;
                    isTie = false;
                }
                else if (score == highestScore)
                {
                    isTie = true;
                }
            }

            if (isTie)
            {
                winner = null;
            }


            // Record game end for stats
            if (GameHistoryManager.Instance != null)
            {
                int playerCount = GameState.PlayerCount;
                var result = new GameResult
                {
                    Winner = winner,
                    YellowFinalScore = GameState.Scores[Player.Yellow],
                    BlueFinalScore = GameState.Scores[Player.Blue],
                    PurpleFinalScore = playerCount >= 3 ? GameState.Scores[Player.Purple] : 0,
                    PinkFinalScore = playerCount >= 4 ? GameState.Scores[Player.Pink] : 0,
                    YellowTanglePoints = tanglePoints[Player.Yellow],
                    BlueTanglePoints = tanglePoints[Player.Blue],
                    PurpleTanglePoints = playerCount >= 3 ? tanglePoints[Player.Purple] : 0,
                    PinkTanglePoints = playerCount >= 4 ? tanglePoints[Player.Pink] : 0,
                    TotalTurns = GameState.TurnNumber,
                    PlayerCount = playerCount,
                    WasForfeited = false
                };
                GameHistoryManager.Instance.EndGame(result);
            }

            ClearSelection();
            UpdateTurnState();
            OnGameStateChanged?.Invoke();
            OnGameEnded?.Invoke(winner);
        }

        private void ClearSelection()
        {
            SelectedGlyphling = null;
            PendingDestination = null;
            PendingCastPosition = null;
            PendingLetter = null;
            _originalPosition = null;
            ValidMoves.Clear();
            ValidCasts.Clear();

            // Draft state
            PendingDraftPosition = null;
            SelectedDraftGlyphling = null;
            ValidDraftPlacements.Clear();
        }

        /// <summary>
        /// Updates CurrentTurnState based on current game conditions.
        /// </summary>
        private void UpdateTurnState()
        {
            GameTurnState previousState = CurrentTurnState;

            if (GameState.IsGameOver)
            {
                CurrentTurnState = GameTurnState.GameOver;
            }
            else if (GameState.Phase == GamePhase.Draft)
            {
                CurrentTurnState = GameTurnState.DraftPlacement;
            }
            else if (CurrentTurnState == GameTurnState.CycleMode)
            {
                // Stay in CycleMode until explicitly exited
                return;
            }
            else if (PendingDestination != null && PendingCastPosition != null && PendingLetter != null)
            {
                CurrentTurnState = GameTurnState.ReadyToConfirm;
            }
            else if (PendingDestination != null)
            {
                CurrentTurnState = GameTurnState.MovePending;
            }
            else if (SelectedGlyphling != null)
            {
                CurrentTurnState = GameTurnState.GlyphlingSelected;
            }
            else
            {
                CurrentTurnState = GameTurnState.Idle;
            }

            if (CurrentTurnState != previousState)
            {
                OnTurnStateChanged?.Invoke(CurrentTurnState);
            }
        }
    }
}