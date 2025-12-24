using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Manages AI controllers for both players.
    /// Supports human vs AI, AI vs AI, or human vs human.
    /// </summary>
    public class AIManager : MonoBehaviour
    {
        public static AIManager Instance { get; private set; }

        [Header("AI Controllers")]
        [SerializeField] private AIController _yellowAI;
        [SerializeField] private AIController _blueAI;

        [Header("AI Speed")]
        [Tooltip("Speed multiplier for AI turns (1 = normal, 2 = fast, 0.5 = slow)")]
        [SerializeField] private float _speedMultiplier = 1f;

        public AIController YellowAI => _yellowAI;
        public AIController BlueAI => _blueAI;
        public float SpeedMultiplier => _speedMultiplier;

        /// <summary>
        /// True if at least one player is AI-controlled.
        /// </summary>
        public bool HasAnyAI => (_yellowAI != null && _yellowAI.enabled) ||
                                 (_blueAI != null && _blueAI.enabled);

        /// <summary>
        /// True if both players are AI-controlled.
        /// </summary>
        public bool IsAIvsAI => (_yellowAI != null && _yellowAI.enabled) &&
                                 (_blueAI != null && _blueAI.enabled);

        private void Awake()
        {
            Instance = this;

            // Create AI controllers if not assigned
            if (_yellowAI == null)
            {
                var yellowObj = new GameObject("YellowAI");
                yellowObj.transform.SetParent(transform);
                _yellowAI = yellowObj.AddComponent<AIController>();
                _yellowAI.SetAIPlayer(Player.Yellow);
                _yellowAI.enabled = false; // Default: human plays Yellow
            }

            if (_blueAI == null)
            {
                var blueObj = new GameObject("BlueAI");
                blueObj.transform.SetParent(transform);
                _blueAI = blueObj.AddComponent<AIController>();
                _blueAI.SetAIPlayer(Player.Blue);
                _blueAI.enabled = false; // Default: human plays Blue (changed from true)
            }
        }

        /// <summary>
        /// Initializes both AI controllers with the word scorer.
        /// </summary>
        public void Initialize(WordScorer wordScorer)
        {
            if (_yellowAI != null)
            {
                _yellowAI.Initialize(wordScorer);
            }

            if (_blueAI != null)
            {
                _blueAI.Initialize(wordScorer);
            }
        }

        /// <summary>
        /// Gets the AI controller for a specific player, or null if not AI-controlled.
        /// </summary>
        public AIController GetAIForPlayer(Player player)
        {
            if (player == Player.Yellow && _yellowAI != null && _yellowAI.enabled)
            {
                return _yellowAI;
            }
            else if (player == Player.Blue && _blueAI != null && _blueAI.enabled)
            {
                return _blueAI;
            }

            return null;
        }

        /// <summary>
        /// Checks if a player is AI-controlled.
        /// </summary>
        public bool IsPlayerAI(Player player)
        {
            return GetAIForPlayer(player) != null;
        }

        /// <summary>
        /// Sets AI speed multiplier.
        /// </summary>
        public void SetSpeedMultiplier(float multiplier)
        {
            _speedMultiplier = Mathf.Clamp(multiplier, 0.25f, 10f);

            // Update think times on both controllers
            if (_yellowAI != null)
            {
                _yellowAI.SetSpeedMultiplier(_speedMultiplier);
            }

            if (_blueAI != null)
            {
                _blueAI.SetSpeedMultiplier(_speedMultiplier);
            }
        }

        /// <summary>
        /// Cycles through speed options: Slow -> Normal -> Fast -> Instant
        /// </summary>
        public string CycleSpeed()
        {
            if (_speedMultiplier <= 0.5f)
            {
                SetSpeedMultiplier(1f);
                return "Normal";
            }
            else if (_speedMultiplier <= 1f)
            {
                SetSpeedMultiplier(2f);
                return "Fast";
            }
            else if (_speedMultiplier <= 2f)
            {
                SetSpeedMultiplier(5f);
                return "Instant";
            }
            else
            {
                SetSpeedMultiplier(0.5f);
                return "Slow";
            }
        }

        /// <summary>
        /// Gets current speed name.
        /// </summary>
        public string GetSpeedName()
        {
            if (_speedMultiplier <= 0.5f) return "Slow";
            if (_speedMultiplier <= 1f) return "Normal";
            if (_speedMultiplier <= 2f) return "Fast";
            return "Instant";
        }

        /// <summary>
        /// Notifies appropriate AI of opponent score.
        /// </summary>
        public void OnPlayerScore(Player scoringPlayer, int points)
        {
            // Notify the OTHER player's AI (if it exists)
            if (scoringPlayer == Player.Yellow && _blueAI != null && _blueAI.enabled)
            {
                _blueAI.OnOpponentScore(points);
            }
            else if (scoringPlayer == Player.Blue && _yellowAI != null && _yellowAI.enabled)
            {
                _yellowAI.OnOpponentScore(points);
            }
        }

        /// <summary>
        /// Resets both AIs for a new game.
        /// </summary>
        public void ResetForNewGame()
        {
            if (_yellowAI != null)
            {
                _yellowAI.ResetForNewGame();
            }

            if (_blueAI != null)
            {
                _blueAI.ResetForNewGame();
            }
        }
    }
}