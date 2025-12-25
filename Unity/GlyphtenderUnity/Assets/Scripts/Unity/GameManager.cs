using UnityEngine;
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
            Debug.Log($"Input mode set to: {mode}");
            OnInputModeChanged?.Invoke();
        }

        public int LastTurnWordCount { get; private set; }

        // Valid moves/casts for current selection
        public List<HexCoord> ValidMoves { get; private set; }
        public List<HexCoord> ValidCasts { get; private set; }

        // Cycle mode tracking for stats
        private int _tilesCycledThisTurn;
        private bool _enteredCycleMode;
        private Player _cycleModeTurnPlayer;
        private List<WordResult> _lastTurnWords;
        private int _lastTurnScore;

        // Events for UI/rendering updates
        public event System.Action OnGameStateChanged;
        public event System.Action OnSelectionChanged;
        public event System.Action OnTurnEnded;
        public event System.Action<Player?> OnGameEnded;
        public event System.Action OnGameRestarted;
        public event System.Action OnInputModeChanged;
        public event System.Action<GameTurnState> OnTurnStateChanged;

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
        }

        private void Start()
        {
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

            // Create new game
            GameState = GameRules.CreateNewGame();

            // Reset all state
            LastTurnWordCount = 0;
            _originalPosition = null;
            _tilesCycledThisTurn = 0;
            _enteredCycleMode = false;
            _lastTurnWords = null;
            _lastTurnScore = 0;

            Debug.Log($"Game initialized. Board has {GameState.Board.HexCount} hexes.");
            Debug.Log($"Dictionary loaded with {WordScorer.WordCount} words.");
            Debug.Log($"Yellow hand: {string.Join(", ", GameState.Hands[Player.Yellow])}");
            Debug.Log($"Blue hand: {string.Join(", ", GameState.Hands[Player.Blue])}");

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
            Debug.Log("AI system ready.");

            // Start game history tracking
            StartGameHistory();

            // Check if it's AI's turn at start
            var currentAI = _aiManager.GetAIForPlayer(GameState.CurrentPlayer);
            if (currentAI != null)
            {
                currentAI.TakeTurn(GameState);
            }
        }

        /// <summary>
        /// Starts tracking game history for stats.
        /// </summary>
        private void StartGameHistory()
        {
            if (GameHistoryManager.Instance == null)
            {
                Debug.LogWarning("GameHistoryManager not found - stats will not be tracked");
                return;
            }

            // Create player info
            PlayerInfo yellowPlayer;
            PlayerInfo bluePlayer;

            var yellowAI = _aiManager?.GetAIForPlayer(Player.Yellow);
            var blueAI = _aiManager?.GetAIForPlayer(Player.Blue);

            if (yellowAI != null)
            {
                yellowPlayer = PlayerInfo.CreateAI(yellowAI.PersonalityName);
            }
            else
            {
                yellowPlayer = PlayerInfo.CreateLocalPlayer("Player");
            }

            if (blueAI != null)
            {
                bluePlayer = PlayerInfo.CreateAI(blueAI.PersonalityName);
            }
            else
            {
                bluePlayer = PlayerInfo.CreateLocalPlayer("Player");
            }

            GameHistoryManager.Instance.StartNewGame(yellowPlayer, bluePlayer, GameState);
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
            else
            {
                Debug.LogError("Could not load words.txt from Resources folder!");
            }
        }

        /// <summary>
        /// Called when player taps/clicks a glyphling.
        /// </summary>
        public void SelectGlyphling(Glyphling glyphling)
        {
            // Block input during AI turn
            if (IsCurrentPlayerAI)
            {
                Debug.Log("AI is playing - input blocked");
                return;
            }

            // Only allow selection in Idle state (or if re-selecting before confirming)
            if (CurrentTurnState != GameTurnState.Idle &&
                CurrentTurnState != GameTurnState.GlyphlingSelected &&
                CurrentTurnState != GameTurnState.MovePending)
            {
                Debug.Log($"Cannot select glyphling in {CurrentTurnState} state");
                return;
            }

            // Can only select own glyphlings
            if (glyphling.Owner != GameState.CurrentPlayer)
            {
                Debug.Log("Not your glyphling!");
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

            Debug.Log($"Selected glyphling at {glyphling.Position}. {ValidMoves.Count} valid moves.");

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
                Debug.Log($"Cannot select destination in {CurrentTurnState} state");
                return;
            }

            if (!ValidMoves.Contains(destination))
            {
                Debug.Log("Invalid move destination!");
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

            Debug.Log($"Moved to {destination}. {ValidCasts.Count} valid cast positions.");

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
                Debug.Log($"Cannot select cast position in {CurrentTurnState} state");
                return;
            }

            if (!ValidCasts.Contains(castPosition))
            {
                Debug.Log("Invalid cast position!");
                return;
            }

            PendingCastPosition = castPosition;
            LastCastOrigin = SelectedGlyphling.Position;

            Debug.Log($"Cast position selected: {castPosition}");

            // If we already have a letter, show ghost and preview words
            if (PendingLetter != null)
            {
                ShowGhostAndPreview();
            }
            else
            {
                Debug.Log("Now select a letter from your hand.");
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
                Debug.Log($"Cannot select letter in {CurrentTurnState} state");
                return;
            }

            if (!GameState.Hands[GameState.CurrentPlayer].Contains(letter))
            {
                Debug.Log("You don't have that letter!");
                return;
            }

            PendingLetter = letter;
            Debug.Log($"Selected letter: {letter}");

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
                Debug.Log($"Would form: {word.Letters} (+{wordScore})");
                previewScore += wordScore;
            }
            Debug.Log($"Total preview score: {previewScore}");

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
        /// Confirms the current move and ends the turn.
        /// </summary>
        public void ConfirmMove()
        {
            // Only allow confirm in ReadyToConfirm state
            if (CurrentTurnState != GameTurnState.ReadyToConfirm)
            {
                Debug.Log($"Cannot confirm move in {CurrentTurnState} state");
                return;
            }

            // Hide ghost tile
            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.HideGhostTile();
            }

            // Store current player before any state changes
            Player currentPlayer = GameState.CurrentPlayer;

            // Place tile
            GameState.Hands[currentPlayer].Remove(PendingLetter.Value);
            GameState.Tiles[PendingCastPosition.Value] = new Tile(
                PendingLetter.Value,
                currentPlayer,
                PendingCastPosition.Value);

            // Score words formed by the new tile
            var newWords = WordScorer.FindWordsAt(GameState, PendingCastPosition.Value, PendingLetter.Value);
            int turnScore = 0;
            foreach (var word in newWords)
            {
                int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, GameState, currentPlayer);
                turnScore += wordScore;
                Debug.Log($"Scored word: {word.Letters} (+{wordScore})");
            }
            GameState.Scores[currentPlayer] += turnScore;
            Debug.Log($"Turn score: {turnScore}. Total: {GameState.Scores[currentPlayer]}");

            // Track how many words were formed
            LastTurnWordCount = newWords.Count;

            // Store for stats recording
            _lastTurnWords = newWords;
            _lastTurnScore = turnScore;

            // If no words formed, enter cycle mode instead of ending turn
            if (newWords.Count == 0)
            {
                Debug.Log("No words formed! Entering cycle mode.");
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
            foreach (var g in tangled)
            {
                Debug.Log($"Glyphling tangled at {g.Position}!");
            }

            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                EndGame();
                return;
            }

            // End turn
            GameRules.EndTurn(GameState);

            Debug.Log($"Turn ended. Now {GameState.CurrentPlayer}'s turn.");

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
                Debug.Log($"Reset glyphling to {_originalPosition.Value}");
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
            foreach (var g in tangled)
            {
                Debug.Log($"Glyphling tangled at {g.Position}!");
            }

            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                EndGame();
                return;
            }

            // End turn
            GameRules.EndTurn(GameState);

            Debug.Log($"Turn ended. Now {GameState.CurrentPlayer}'s turn.");

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
            foreach (var g in tangled)
            {
                Debug.Log($"Glyphling tangled at {g.Position}!");
            }

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
        private void EndGame()
        {
            GameState.IsGameOver = true;

            // Calculate and award tangle points
            var tanglePoints = TangleChecker.CalculateTanglePoints(GameState);
            GameState.Scores[Player.Yellow] += tanglePoints[Player.Yellow];
            GameState.Scores[Player.Blue] += tanglePoints[Player.Blue];

            Debug.Log($"Tangle points - Yellow: +{tanglePoints[Player.Yellow]}, Blue: +{tanglePoints[Player.Blue]}");
            Debug.Log($"Final scores - Yellow: {GameState.Scores[Player.Yellow]}, Blue: {GameState.Scores[Player.Blue]}");

            // Determine winner
            Player? winner = null;
            if (GameState.Scores[Player.Yellow] > GameState.Scores[Player.Blue])
            {
                winner = Player.Yellow;
            }
            else if (GameState.Scores[Player.Blue] > GameState.Scores[Player.Yellow])
            {
                winner = Player.Blue;
            }
            // If equal, winner stays null (tie)

            if (winner != null)
            {
                Debug.Log($"{winner} wins!");
            }
            else
            {
                Debug.Log("It's a tie!");
            }

            // Record game end for stats
            if (GameHistoryManager.Instance != null)
            {
                var result = new GameResult
                {
                    Winner = winner,
                    YellowFinalScore = GameState.Scores[Player.Yellow],
                    BlueFinalScore = GameState.Scores[Player.Blue],
                    YellowTanglePoints = tanglePoints[Player.Yellow],
                    BlueTanglePoints = tanglePoints[Player.Blue],
                    TotalTurns = GameState.TurnNumber,
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
                Debug.Log($"Turn state: {previousState} -> {CurrentTurnState}");
                OnTurnStateChanged?.Invoke(CurrentTurnState);
            }
        }
    }
}