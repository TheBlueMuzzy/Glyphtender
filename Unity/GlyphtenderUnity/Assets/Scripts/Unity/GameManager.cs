using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
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

        public bool IsInCycleMode { get; private set; }
        public int LastTurnWordCount { get; private set; }

        // Valid moves/casts for current selection
        public List<HexCoord> ValidMoves { get; private set; }
        public List<HexCoord> ValidCasts { get; private set; }

        // Events for UI/rendering updates
        public event System.Action OnGameStateChanged;
        public event System.Action OnSelectionChanged;
        public event System.Action OnTurnEnded;

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
            // Load dictionary
            WordScorer = new WordScorer();
            LoadDictionary();

            // Create new game
            GameState = GameRules.CreateNewGame();

            Debug.Log($"Game initialized. Board has {GameState.Board.HexCount} hexes.");
            Debug.Log($"Dictionary loaded with {WordScorer.WordCount} words.");
            Debug.Log($"Yellow hand: {string.Join(", ", GameState.Hands[Player.Yellow])}");
            Debug.Log($"Blue hand: {string.Join(", ", GameState.Hands[Player.Blue])}");

            ClearSelection();
            OnGameStateChanged?.Invoke();
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

            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called when player taps/clicks a hex for movement.
        /// </summary>
        public void SelectDestination(HexCoord destination)
        {
            if (SelectedGlyphling == null)
            {
                Debug.Log("Select a glyphling first!");
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

            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();  // Add this line to update glyphling visual position
        }

        /// <summary>
        /// Called when player taps/clicks a hex for casting.
        /// </summary>
        public void SelectCastPosition(HexCoord castPosition)
        {
            if (PendingDestination == null)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            if (!ValidCasts.Contains(castPosition))
            {
                Debug.Log("Invalid cast position!");
                return;
            }

            PendingCastPosition = castPosition;
            LastCastOrigin = SelectedGlyphling.Position;

            Debug.Log($"Cast position selected: {castPosition}. Now select a letter from your hand.");

            // If a letter is already selected, move the ghost tile to new position
            if (PendingLetter != null)
            {
                var boardRenderer = FindObjectOfType<BoardRenderer>();
                if (boardRenderer != null)
                {
                    boardRenderer.ShowGhostTile(castPosition, PendingLetter.Value, GameState.CurrentPlayer);
                }
            }

            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Called when player selects a letter from their hand.
        /// </summary>
        public void SelectLetter(char letter)
        {
            if (PendingCastPosition == null)
            {
                Debug.Log("Select a cast position first!");
                return;
            }

            if (!GameState.Hands[GameState.CurrentPlayer].Contains(letter))
            {
                Debug.Log("You don't have that letter!");
                return;
            }

            PendingLetter = letter;

            // Preview words that would be formed
            var previewWords = WordScorer.FindWordsAt(GameState, PendingCastPosition.Value, letter);
            int previewScore = 0;
            foreach (var word in previewWords)
            {
                Debug.Log($"Would form: {word.Letters} (+{word.Score})");
                previewScore += word.Score;
            }
            Debug.Log($"Total preview score: {previewScore}");

            // Show ghost tile preview
            var boardRenderer = FindObjectOfType<BoardRenderer>();
            if (boardRenderer != null)
            {
                boardRenderer.ShowGhostTile(PendingCastPosition.Value, letter, GameState.CurrentPlayer);
            }

            OnSelectionChanged?.Invoke();
        }

        /// <summary>
        /// Confirms the current move and ends the turn.
        /// </summary>
        public void ConfirmMove()
        {
            if (SelectedGlyphling == null || PendingDestination == null ||
                PendingCastPosition == null || PendingLetter == null)
            {
                Debug.Log("Move not complete!");
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
                IsInCycleMode = true;
                ClearSelection();
                OnSelectionChanged?.Invoke();
                OnGameStateChanged?.Invoke();
                return;  // Don't end turn yet, don't draw tile
            }

            // Draw new tile
            GameRules.DrawTile(GameState, GameState.CurrentPlayer);

            // Check for tangles
            var tangled = TangleChecker.CheckAndScoreTangles(GameState);
            foreach (var g in tangled)
            {
                Debug.Log($"Glyphling tangled at {g.Position}! +{TangleChecker.TangleBonus} to opponent.");
            }

            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                GameState.IsGameOver = true;
                Debug.Log("Game Over!");
            }

            // End turn
            GameRules.EndTurn(GameState);

            Debug.Log($"Turn ended. Now {GameState.CurrentPlayer}'s turn.");

            ClearSelection();
            OnTurnEnded?.Invoke();
            OnGameStateChanged?.Invoke();
        }

        /// <summary>
        /// Resets the current move (undo before confirm).
        /// </summary>
        public void ResetMove()
        {
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
            OnSelectionChanged?.Invoke();
            OnGameStateChanged?.Invoke();

            IsResetting = false;
        }
        /// <summary>
        /// Ends cycle mode and finishes the turn.
        /// </summary>
        public void EndCycleMode()
        {
            IsInCycleMode = false;

            // Check for tangles
            var tangled = TangleChecker.CheckAndScoreTangles(GameState);
            foreach (var g in tangled)
            {
                Debug.Log($"Glyphling tangled at {g.Position}! +{TangleChecker.TangleBonus} to opponent.");
            }

            // Check game over
            if (TangleChecker.ShouldEndGame(GameState))
            {
                GameState.IsGameOver = true;
                Debug.Log("Game Over!");
            }

            // End turn
            GameRules.EndTurn(GameState);

            Debug.Log($"Turn ended. Now {GameState.CurrentPlayer}'s turn.");

            ClearSelection();
            OnTurnEnded?.Invoke();
            OnGameStateChanged?.Invoke();
        }

        private void ClearSelection()
        {
            SelectedGlyphling = null;
            PendingDestination = null;
            PendingCastPosition = null;
            PendingLetter = null;
            ValidMoves.Clear();
            ValidCasts.Clear();
        }
    }
}