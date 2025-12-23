using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Glyphtender.Core;

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
        [SerializeField] private Player _aiPlayer = Player.Blue;

        [Header("Think Time")]
        [Tooltip("Minimum time AI 'thinks' before moving (feels more natural)")]
        [SerializeField] private float _minThinkTime = 0.5f;
        [Tooltip("Maximum think time")]
        [SerializeField] private float _maxThinkTime = 2f;

        [Header("References")]
        [SerializeField] private GameManager _gameManager;
        [SerializeField] private BoardRenderer _boardRenderer;

        private AIBrain _brain;
        private bool _isThinking;
        private WordScorer _wordScorer;

        public bool IsThinking => _isThinking;
        public string PersonalityName => _personalityName;
        public Player AIPlayer => _aiPlayer;

        private void Awake()
        {
            if (_gameManager == null)
                _gameManager = FindObjectOfType<GameManager>();
            if (_boardRenderer == null)
                _boardRenderer = FindObjectOfType<BoardRenderer>();
        }

        /// <summary>
        /// Initializes the AI with the given WordScorer.
        /// Call this after the dictionary is loaded.
        /// </summary>
        public void Initialize(WordScorer wordScorer)
        {
            _wordScorer = wordScorer;

            var personality = PersonalityPresets.GetByName(_personalityName);
            _brain = new AIBrain(_aiPlayer, personality, _wordScorer);

            Debug.Log($"AI initialized: {personality.Name} - {personality.Description}");
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
                _brain = new AIBrain(_aiPlayer, personality, _wordScorer);
                Debug.Log($"AI personality changed to: {personality.Name}");
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
                _brain = new AIBrain(_aiPlayer, personality, _wordScorer);
            }
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

            StartCoroutine(ThinkAndMove(state));
        }

        /// <summary>
        /// Coroutine that thinks for a moment, then executes the move.
        /// </summary>
        private IEnumerator ThinkAndMove(GameState state)
        {
            _isThinking = true;

            // Random think time for natural feel
            float thinkTime = Random.Range(_minThinkTime, _maxThinkTime);

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
                ExecuteMove(chosenMove, state);
            }
            else
            {
                Debug.LogWarning("AI found no valid moves!");
                // No valid moves - go to cycle mode
                ExecuteCycle(state);
            }

            Debug.Log($"AI turn complete. Next player: {state.CurrentPlayer}");

            _isThinking = false;
        }

        /// <summary>
        /// Executes the AI's chosen move through the game systems.
        /// </summary>
        private void ExecuteMove(AIMove move, GameState state)
        {
            StartCoroutine(ExecuteMoveAnimated(move, state));
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

            // Step 1: Move the glyphling
            actualGlyphling.Position = move.Destination;

            // Refresh board to trigger move animation
            if (_boardRenderer != null)
            {
                _boardRenderer.RefreshBoard();
            }

            // Wait for move animation
            yield return new WaitForSeconds(0.6f);

            // Step 2: Place the tile
            state.Hands[_aiPlayer].Remove(move.Letter);
            state.Tiles[move.CastPosition] = new Tile(move.Letter, _aiPlayer, move.CastPosition);

            // Refresh board to show tile
            if (_boardRenderer != null)
            {
                _boardRenderer.RefreshBoard();
            }

            // Wait for tile animation
            yield return new WaitForSeconds(0.4f);

            // Step 3: Score the words
            var words = _wordScorer.FindWordsAt(state, move.CastPosition, move.Letter);
            int totalPoints = 0;

            foreach (var word in words)
            {
                int points = WordScorer.ScoreWordForPlayer(
                    word.Letters, word.Positions, state, _aiPlayer);
                totalPoints += points;
                Debug.Log($"AI formed: {word.Letters} for {points} points");
            }

            // Update perception
            _brain.OnScore(totalPoints);

            // Update game state scores
            state.Scores[_aiPlayer] += totalPoints;

            // Draw new tile
            GameRules.DrawTile(state, _aiPlayer);

            // Refresh to show score update
            if (_boardRenderer != null)
            {
                _boardRenderer.RefreshBoard();
            }

            // Brief pause before ending turn
            yield return new WaitForSeconds(0.3f);

            // End turn
            _brain.EndTurn();
            GameRules.EndTurn(state);

            // Notify game manager that AI turn is complete
            if (_gameManager != null)
            {
                _gameManager.OnTurnComplete();
            }

            Debug.Log($"AI turn complete. Next player: {state.CurrentPlayer}");
        }

        /// <summary>
        /// Executes cycle mode when AI has no valid word moves.
        /// </summary>
        private void ExecuteCycle(GameState state)
        {
            Debug.Log("AI entering cycle mode (no valid moves)");

            var discards = _brain.ChooseDiscards(state);

            if (discards.Count > 0)
            {
                Debug.Log($"AI discards: {string.Join(", ", discards)}");

                var hand = state.Hands[_aiPlayer];
                foreach (var letter in discards)
                {
                    hand.Remove(letter);
                    GameRules.DrawTile(state, _aiPlayer);
                }
            }
            else
            {
                Debug.Log("AI keeps hand (no discards)");
            }

            // End turn
            _brain.EndTurn();
            GameRules.EndTurn(state);

            // Notify game manager that AI turn is complete
            if (_gameManager != null)
            {
                _gameManager.OnTurnComplete();
            }

            // Refresh and notify
            if (_boardRenderer != null)
            {
                _boardRenderer.RefreshBoard();
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
    }
}