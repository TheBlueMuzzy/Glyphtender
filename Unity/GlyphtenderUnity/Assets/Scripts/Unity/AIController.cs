using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Glyphtender.Core;
using Glyphtender.Unity.Stats;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Unity controller for AI opponent.
    /// Hooks AIBrain into the game loop with coroutines for smooth play.
    /// </summary>
    public class AIController : MonoBehaviour
    {
        [Header("AI Settings")]
        [SerializeField] private string _personalityName = "Balanced";
        [SerializeField] private AIDifficulty _difficulty = AIDifficulty.Apprentice;
        [SerializeField] private Player _aiPlayer = Player.Blue;

        [Header("Think Time")]
        [Tooltip("Minimum time AI 'thinks' before moving (feels more natural)")]
        [SerializeField] private float _minThinkTime = 0.5f;
        [Tooltip("Maximum think time")]
        [SerializeField] private float _maxThinkTime = 2f;

        private float _speedMultiplier = 1f;

        private AIBrain _brain;
        private bool _isThinking;
        private WordScorer _wordScorer;

        public bool IsThinking => _isThinking;
        public string PersonalityName => _personalityName;
        public Player AIPlayer => _aiPlayer;
        public AIDifficulty Difficulty => _difficulty;

        /// <summary>
        /// Initializes the AI with the given WordScorer.
        /// Call this after the dictionary is loaded.
        /// </summary>
        public void Initialize(WordScorer wordScorer)
        {
            _wordScorer = wordScorer;

            var personality = PersonalityPresets.GetByName(_personalityName);
            _brain = new AIBrain(_aiPlayer, personality, _wordScorer, _difficulty);

            Debug.Log($"AI initialized: {personality.Name} ({_difficulty}) - {personality.Description}");
        }

        /// <summary>
        /// Changes the AI personality mid-game.
        /// </summary>
        public void SetPersonality(string personalityName)
        {
            _personalityName = personalityName;

            if (_wordScorer != null)
            {
                var personality = PersonalityPresets.GetByName(_personalityName);
                _brain = new AIBrain(_aiPlayer, personality, _wordScorer, _difficulty);
                Debug.Log($"AI personality changed to: {personality.Name} ({_difficulty})");
            }
        }

        /// <summary>
        /// Changes the AI difficulty mid-game.
        /// </summary>
        public void SetDifficulty(AIDifficulty difficulty)
        {
            _difficulty = difficulty;

            if (_wordScorer != null && _brain != null)
            {
                _brain.SetDifficulty(difficulty);
                Debug.Log($"AI difficulty changed to: {difficulty}");
            }
        }

        /// <summary>
        /// Sets which player the AI controls.
        /// </summary>
        public void SetAIPlayer(Player player)
        {
            _aiPlayer = player;

            if (_brain != null && _wordScorer != null)
            {
                var personality = PersonalityPresets.GetByName(_personalityName);
                _brain = new AIBrain(_aiPlayer, personality, _wordScorer, _difficulty);
            }
        }

        /// <summary>
        /// Sets the speed multiplier for AI animations.
        /// Higher = faster animations.
        /// </summary>
        public void SetSpeedMultiplier(float multiplier)
        {
            _speedMultiplier = Mathf.Max(0.1f, multiplier);
        }

        /// <summary>
        /// Helper to get scaled wait time.
        /// </summary>
        private float ScaledWait(float baseTime)
        {
            return baseTime / _speedMultiplier;
        }

        /// <summary>
        /// Call this when it becomes the AI's turn.
        /// </summary>
        public void TakeTurn(GameState state)
        {
            if (_brain == null)
            {
                Debug.LogError("AIController.TakeTurn called but AI not initialized!");
                return;
            }

            if (_isThinking)
            {
                Debug.LogWarning("AI is already thinking!");
                return;
            }

            // Don't start if menu is open (paused)
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
            {
                return;
            }

            StartCoroutine(ThinkAndMove(state));
        }

        /// <summary>
        /// Takes over a turn in progress, handling whatever state it's in.
        /// </summary>
        public void TakeOverTurn(GameState state)
        {
            if (_brain == null)
            {
                Debug.LogError("AIController.TakeOverTurn called but AI not initialized!");
                return;
            }

            if (_isThinking)
            {
                Debug.LogWarning("AI is already thinking!");
                return;
            }

            // Don't start if menu is open (paused)
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
            {
                return;
            }

            var turnState = GameManager.Instance.CurrentTurnState;

            if (turnState == GameTurnState.CycleMode)
            {
                // Handle cycle mode - choose discards and confirm
                StartCoroutine(HandleCycleMode(state));
            }
            else
            {
                // Reset any partial move and play full turn
                GameManager.Instance.ResetMove();
                TakeTurn(state);
            }
        }

        /// <summary>
        /// Handles cycle mode when AI takes over mid-turn.
        /// </summary>
        private IEnumerator HandleCycleMode(GameState state)
        {
            _isThinking = true;

            yield return new WaitForSeconds(ScaledWait(0.5f));

            // Choose discards using AI logic
            var discards = _brain.ChooseDiscards(state);
            int tilesCycled = 0;

            if (discards.Count > 0)
            {
                Debug.Log($"AI discards: {string.Join(", ", discards)}");

                var hand = state.Hands[_aiPlayer];
                foreach (var letter in discards)
                {
                    hand.Remove(letter);
                    GameRules.DrawTile(state, _aiPlayer);
                    tilesCycled++;
                }
            }
            else
            {
                Debug.Log("AI keeps hand (no discards)");
            }

            // Exit cycle mode through HandController
            if (HandController.Instance != null)
            {
                HandController.Instance.ConfirmCycleDiscard();
            }
            else
            {
                // Fallback if no HandController
                _brain.EndTurn();
                GameRules.EndTurn(state);

                if (GameManager.Instance != null)
                {
                    GameManager.Instance.OnTurnComplete();
                }
            }

            _isThinking = false;
        }

        /// <summary>
        /// Coroutine that thinks for a moment, then executes the move.
        /// </summary>
        private IEnumerator ThinkAndMove(GameState state)
        {
            _isThinking = true;

            // Random think time for natural feel (scaled by speed)
            float thinkTime = Random.Range(_minThinkTime, _maxThinkTime) / _speedMultiplier;

            // Start thinking (this is synchronous but fast)
            AIMove chosenMove = null;
            float startTime = Time.realtimeSinceStartup;

            chosenMove = _brain.ChooseMove(state);

            float elapsed = Time.realtimeSinceStartup - startTime;
            Debug.Log($"AI decision took {elapsed:F3}s");

            // Wait remaining think time
            float remainingWait = thinkTime - elapsed;
            if (remainingWait > 0)
            {
                yield return new WaitForSeconds(remainingWait);
            }

            // Execute the move
            if (chosenMove != null)
            {
                yield return StartCoroutine(ExecuteMoveAnimated(chosenMove, state));
            }
            else
            {
                Debug.LogWarning("AI found no valid moves!");
                // No valid moves - go to cycle mode
                yield return StartCoroutine(ExecuteCycleAnimated(state));
            }

            Debug.Log($"AI turn complete. Next player: {state.CurrentPlayer}");

            _isThinking = false;
        }

        /// <summary>
        /// Executes the move with proper animation timing.
        /// </summary>
        private IEnumerator ExecuteMoveAnimated(AIMove move, GameState state)
        {
            Debug.Log($"AI plays: {move.Letter} at {move.CastPosition}, " +
                      $"glyphling {move.Glyphling.Index} to {move.Destination}");

            // Find the actual glyphling in the state (not the cloned one)
            Glyphling actualGlyphling = null;
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == move.Glyphling.Owner && g.Index == move.Glyphling.Index)
                {
                    actualGlyphling = g;
                    break;
                }
            }

            if (actualGlyphling == null)
            {
                Debug.LogError("Could not find glyphling for AI move!");
                _isThinking = false;
                yield break;
            }

            // Begin move tracking for stats
            HexCoord fromPosition = actualGlyphling.Position;
            GameHistoryManager.Instance?.BeginMove(actualGlyphling, state);

            // Step 1: Move the glyphling
            actualGlyphling.Position = move.Destination;

            // Track destination for stats
            GameHistoryManager.Instance?.SetMoveDestination(move.Destination);

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
            }

            yield return new WaitForSeconds(ScaledWait(0.6f));

            // Step 2: Place the tile
            if (GameManager.Instance != null)
            {
                GameManager.Instance.SetLastCastOrigin(move.Destination);
            }
            state.Hands[_aiPlayer].Remove(move.Letter);
            state.Tiles[move.CastPosition] = new Tile(move.Letter, _aiPlayer, move.CastPosition);

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
            }

            yield return new WaitForSeconds(ScaledWait(0.5f));

            // Step 3: Show preview score and word highlights
            var words = _wordScorer.FindWordsAt(state, move.CastPosition, move.Letter);
            int totalPoints = 0;

            foreach (var word in words)
            {
                int points = WordScorer.ScoreWordForPlayer(
                    word.Letters, word.Positions, state, _aiPlayer);
                totalPoints += points;
                Debug.Log($"AI formed: {word.Letters} for {points} points");
            }

            if (ScoreDisplay.Instance != null && totalPoints > 0)
            {
                ScoreDisplay.Instance.ShowPreview(totalPoints);
            }

            if (WordHighlighter.Instance != null)
            {
                WordHighlighter.Instance.HighlightWordsAt(move.CastPosition, move.Letter);
            }

            yield return new WaitForSeconds(ScaledWait(1.0f));

            // Step 4: Clear highlights and finalize score
            if (WordHighlighter.Instance != null)
            {
                WordHighlighter.Instance.ClearHighlights();
            }

            _brain.OnScore(totalPoints);
            state.Scores[_aiPlayer] += totalPoints;

            // Record move for stats (normal case - words formed)
            RecordAIMove(state, move.CastPosition, move.Letter, words, totalPoints, false, 0);

            GameRules.DrawTile(state, _aiPlayer);

            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
            }

            yield return new WaitForSeconds(ScaledWait(0.3f));

            // Step 5: End turn
            _brain.EndTurn();
            GameRules.EndTurn(state);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnTurnComplete();
            }

            Debug.Log($"AI turn complete. Next player: {state.CurrentPlayer}");
        }

        /// <summary>
        /// Records an AI move for stats tracking.
        /// </summary>
        private void RecordAIMove(GameState state, HexCoord castPosition, char letter,
            List<WordResult> words, int score, bool cycleMode, int tilesCycled)
        {
            if (GameHistoryManager.Instance == null) return;

            GameHistoryManager.Instance.RecordMove(
                state,
                _aiPlayer,
                castPosition,
                letter,
                words,
                score,
                cycleMode,
                tilesCycled
            );
        }

        /// <summary>
        /// Executes cycle mode when AI has no valid word moves.
        /// </summary>
        private IEnumerator ExecuteCycleAnimated(GameState state)
        {
            Debug.Log("AI entering cycle mode (no valid moves)");

            yield return new WaitForSeconds(ScaledWait(0.3f));

            var discards = _brain.ChooseDiscards(state);
            int tilesCycled = 0;

            if (discards.Count > 0)
            {
                Debug.Log($"AI discards: {string.Join(", ", discards)}");

                var hand = state.Hands[_aiPlayer];
                foreach (var letter in discards)
                {
                    hand.Remove(letter);
                    GameRules.DrawTile(state, _aiPlayer);
                    tilesCycled++;
                }
            }
            else
            {
                Debug.Log("AI keeps hand (no discards)");
            }

            // Note: For AI cycle mode, we don't have a proper move to record
            // because the AI didn't actually place a tile. The cycle mode stats
            // will be tracked when the AI eventually makes a real move.
            // This matches how human cycle mode works - the move is recorded
            // when EndCycleMode is called, not during the cycle itself.

            // End turn
            _brain.EndTurn();
            GameRules.EndTurn(state);

            // Notify game manager that AI turn is complete
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnTurnComplete();
            }

            // Refresh and notify
            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.RefreshBoard();
            }
        }

        /// <summary>
        /// Call this when the human player scores, so AI can track.
        /// </summary>
        public void OnOpponentScore(int points)
        {
            if (_brain != null)
            {
                _brain.OnOpponentScore(points);
            }
        }

        /// <summary>
        /// Resets the AI for a new game.
        /// </summary>
        public void ResetForNewGame()
        {
            if (_brain != null)
            {
                _brain.Reset();
            }
            _isThinking = false;
        }

        /// <summary>
        /// Gets all available personality names for UI.
        /// </summary>
        public static string[] GetAvailablePersonalities()
        {
            return PersonalityPresets.GetAllNames();
        }

        /// <summary>
        /// Gets all available difficulty names for UI.
        /// </summary>
        public static string[] GetAvailableDifficulties()
        {
            return new string[] { "Apprentice", "1st Class", "Archmage" };
        }
    }
}