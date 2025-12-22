using UnityEngine;
using Glyphtender.Core;
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

        public bool IsInCycleMode => CurrentTurnState == GameTurnState.CycleMode;
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

            Debug.Log($"Game initialized. Board has {GameState.Board.HexCount} hexes.");
            Debug.Log($"Dictionary loaded with {WordScorer.WordCount} words.");
            Debug.Log($"Yellow hand: {string.Join(", ", GameState.Hands[Player.Yellow])}");
            Debug.Log($"Blue hand: {string.Join(", ", GameState.Hands[Player.Blue])}");

            ClearSelection();
            UpdateTurnState();
            OnGameStateChanged?.Invoke();
            OnGameRestarted?.Invoke();
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

            Debug.Log($"Selected glyphling at {glyphling.Position}. {ValidMoves.Count} valid moves.");

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called when player taps/clicks a hex for movement.
        /// </summary>
        public void SelectDestination(HexCoord destination)
        {
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

            // Calculate valid cast positions from new location
            ValidCasts = GameRules.GetValidCastPositions(GameState, SelectedGlyphling);
            ValidMoves.Clear();

            Debug.Log($"Moved to {destination}. {ValidCasts.Count} valid cast positions.");

            UpdateTurnState();
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();  // Add this line to update glyphling visual position
        }

        /// <summary>
        /// Called when player taps/clicks a hex for casting.
        /// </summary>
        public void SelectCastPosition(HexCoord castPosition)
        {
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
                Debug.Log($"Would form: {word.Letters} (+{word.Score})");
                previewScore += word.Score;
            }
            Debug.Log($"Total preview score: {previewScore}");

            // Only show ghost tile in tap mode
            if (CurrentInputMode == InputMode.Tap)
            {
                var boardRenderer = FindObjectOfType<BoardRenderer>();
                if (boardRenderer != null)
                {
                    boardRenderer.ShowGhostTile(PendingCastPosition.Value, PendingLetter.Value, GameState.CurrentPlayer);
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
            var boardRenderer = FindObjectOfType<BoardRenderer>();
            if (boardRenderer != null)
            {
                boardRenderer.HideGhostTile();
            }

            // Place tile
            GameState.Hands[GameState.CurrentPlayer].Remove(PendingLetter.Value);
            GameState.Tiles[PendingCastPosition.Value] = new Tile(
                PendingLetter.Value,
                GameState.CurrentPlayer,
                PendingCastPosition.Value);

            // Score words formed by the new tile
            var newWords = WordScorer.FindWordsAt(GameState, PendingCastPosition.Value, PendingLetter.Value);
            int turnScore = 0;
            foreach (var word in newWords)
            {
                int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, GameState, GameState.CurrentPlayer);
                turnScore += wordScore;
                Debug.Log($"Scored word: {word.Letters} (+{wordScore})");
            }
            GameState.Scores[GameState.CurrentPlayer] += turnScore;
            Debug.Log($"Turn score: {turnScore}. Total: {GameState.Scores[GameState.CurrentPlayer]}");

            // Track how many words were formed
            LastTurnWordCount = newWords.Count;

            // If no words formed, enter cycle mode instead of ending turn
            if (newWords.Count == 0)
            {
                Debug.Log("No words formed! Entering cycle mode.");
                CurrentTurnState = GameTurnState.CycleMode;
                ClearSelection();
                OnSelectionChanged?.Invoke();
                OnGameStateChanged?.Invoke();
                return;  // Don't end turn yet, don't draw tile
            }

            // Draw new tile
            GameRules.DrawTile(GameState, GameState.CurrentPlayer);

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
            OnGameStateChanged?.Invoke();
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
            var boardRenderer = FindObjectOfType<BoardRenderer>();
            if (boardRenderer != null)
            {
                boardRenderer.HideGhostTile();
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
            OnGameStateChanged?.Invoke();
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