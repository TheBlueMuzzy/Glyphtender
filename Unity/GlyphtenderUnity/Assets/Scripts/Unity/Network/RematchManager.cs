/*******************************************************************************
 * RematchManager.cs
 *
 * PURPOSE:
 *   Manages rematch state tracking for end-of-game rematch flow.
 *   Tracks each player's rematch decision and coordinates the rematch timer.
 *
 * RESPONSIBILITIES:
 *   - Track per-player rematch status (Pending/Confirmed/Declined)
 *   - Manage rematch countdown timer
 *   - Fire events for UI updates and rematch completion
 *   - Support flexible player count (4p can become 2p rematch)
 *
 * ARCHITECTURE:
 *   - Singleton pattern matching GameManager
 *   - Event-driven updates for UI
 *   - Works with NetworkGameBridge for online sync
 *
 * USAGE:
 *   RematchManager.Instance.Initialize(playerCount);
 *   RematchManager.Instance.SetPlayerStatus(player, RematchStatus.Confirmed);
 ******************************************************************************/

using UnityEngine;
using System;
using System.Collections.Generic;
using Glyphtender.Core;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Represents a player's rematch decision state.
    /// </summary>
    public enum RematchStatus
    {
        Pending = 0,    // Hasn't decided yet
        Confirmed = 1,  // Wants to rematch
        Declined = 2    // Declined or left
    }

    /// <summary>
    /// Manages rematch state and timer for end-of-game flow.
    /// </summary>
    public class RematchManager : MonoBehaviour
    {
        public static RematchManager Instance { get; private set; }

        // Configuration
        [Tooltip("How long players have to decide on rematch (seconds)")]
        public float RematchTimerDuration = 30f;

        // State
        private Dictionary<Player, RematchStatus> _playerStatuses = new Dictionary<Player, RematchStatus>();
        private float _timerStartTime;
        private float _timerDuration;
        private bool _timerActive;
        private int _playerCount;
        private bool _isResolved;  // Prevents multiple resolution

        // Events
        /// <summary>
        /// Fired when a player's status changes.
        /// </summary>
        public event Action<Player, RematchStatus> OnPlayerStatusChanged;

        /// <summary>
        /// Fired when the timer starts (passes duration).
        /// </summary>
        public event Action<float> OnTimerStarted;

        /// <summary>
        /// Fired when the timer expires.
        /// </summary>
        public event Action OnTimerExpired;

        /// <summary>
        /// Fired when 2+ players confirm rematch (passes list of confirmed players).
        /// </summary>
        public event Action<List<Player>> OnRematchConfirmed;

        /// <summary>
        /// Fired when rematch is cancelled (not enough players).
        /// </summary>
        public event Action OnRematchCancelled;

        /// <summary>
        /// True if the rematch timer is currently counting down.
        /// </summary>
        public bool IsTimerActive => _timerActive;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }

        private void Update()
        {
            if (_timerActive && !_isResolved)
            {
                float remaining = GetTimeRemaining();
                if (remaining <= 0f)
                {
                    HandleTimerExpired();
                }
            }
        }

        /// <summary>
        /// Initializes rematch state for a new end-game screen.
        /// Call this when the game ends and end screen is shown.
        /// </summary>
        /// <param name="playerCount">Number of players in the game (2-4)</param>
        public void Initialize(int playerCount)
        {
            _playerCount = Mathf.Clamp(playerCount, 2, 4);
            _playerStatuses.Clear();
            _timerActive = false;
            _timerStartTime = 0f;
            _timerDuration = RematchTimerDuration;
            _isResolved = false;

            // Initialize all players to Pending
            var players = new Player[] { Player.Yellow, Player.Blue, Player.Purple, Player.Pink };
            for (int i = 0; i < _playerCount; i++)
            {
                _playerStatuses[players[i]] = RematchStatus.Pending;
            }

            Debug.Log($"[RematchManager] Initialized for {_playerCount} players");
        }

        /// <summary>
        /// Sets a player's rematch status.
        /// If this is the first Confirmed status, starts the timer.
        /// </summary>
        public void SetPlayerStatus(Player player, RematchStatus status)
        {
            if (_isResolved)
            {
                Debug.LogWarning("[RematchManager] SetPlayerStatus called after resolution");
                return;
            }

            if (!_playerStatuses.ContainsKey(player))
            {
                Debug.LogWarning($"[RematchManager] Player {player} not part of this game");
                return;
            }

            var previousStatus = _playerStatuses[player];
            _playerStatuses[player] = status;

            Debug.Log($"[RematchManager] {player} status: {previousStatus} -> {status}");

            // If first Confirmed status, start timer
            if (status == RematchStatus.Confirmed && !_timerActive)
            {
                StartTimer();
            }

            // Fire event
            OnPlayerStatusChanged?.Invoke(player, status);

            // Check if we can resolve early
            CheckEarlyCompletion();
        }

        /// <summary>
        /// Gets a player's current rematch status.
        /// </summary>
        public RematchStatus GetPlayerStatus(Player player)
        {
            if (_playerStatuses.TryGetValue(player, out var status))
            {
                return status;
            }
            return RematchStatus.Pending;
        }

        /// <summary>
        /// Starts the rematch countdown timer.
        /// Called automatically when first player confirms.
        /// </summary>
        public void StartTimer()
        {
            if (_timerActive) return;

            _timerStartTime = Time.time;
            _timerDuration = RematchTimerDuration;
            _timerActive = true;

            Debug.Log($"[RematchManager] Timer started: {_timerDuration}s");
            OnTimerStarted?.Invoke(_timerDuration);
        }

        /// <summary>
        /// Syncs timer state from network (for clients joining mid-countdown).
        /// </summary>
        /// <param name="startTime">Server time when timer started</param>
        /// <param name="duration">Timer duration in seconds</param>
        public void SyncTimer(float startTime, float duration)
        {
            if (_timerActive) return;

            _timerStartTime = startTime;
            _timerDuration = duration;
            _timerActive = true;

            Debug.Log($"[RematchManager] Timer synced from network: {GetTimeRemaining()}s remaining");
            OnTimerStarted?.Invoke(duration);
        }

        /// <summary>
        /// Gets the time remaining on the rematch timer.
        /// </summary>
        public float GetTimeRemaining()
        {
            if (!_timerActive) return 0f;

            float elapsed = Time.time - _timerStartTime;
            return Mathf.Max(0f, _timerDuration - elapsed);
        }

        /// <summary>
        /// Gets list of players who have confirmed rematch.
        /// </summary>
        public List<Player> GetConfirmedPlayers()
        {
            var confirmed = new List<Player>();
            foreach (var kvp in _playerStatuses)
            {
                if (kvp.Value == RematchStatus.Confirmed)
                {
                    confirmed.Add(kvp.Key);
                }
            }
            return confirmed;
        }

        /// <summary>
        /// Called when the timer expires.
        /// Determines if rematch happens based on confirmed count.
        /// </summary>
        public void HandleTimerExpired()
        {
            if (_isResolved) return;

            _timerActive = false;
            _isResolved = true;

            Debug.Log("[RematchManager] Timer expired");
            OnTimerExpired?.Invoke();

            ResolveRematch();
        }

        /// <summary>
        /// Checks if all players have decided, enabling early resolution.
        /// </summary>
        private void CheckEarlyCompletion()
        {
            if (_isResolved) return;

            int confirmed = 0;
            int decided = 0;

            foreach (var kvp in _playerStatuses)
            {
                if (kvp.Value == RematchStatus.Confirmed) confirmed++;
                if (kvp.Value != RematchStatus.Pending) decided++;
            }

            // If all players have decided, resolve immediately
            if (decided == _playerStatuses.Count)
            {
                Debug.Log($"[RematchManager] All players decided ({confirmed} confirmed)");
                _timerActive = false;
                _isResolved = true;
                ResolveRematch();
            }
            // If it's impossible to get 2+ confirmed (too many declined), cancel early
            else if (_playerStatuses.Count - decided + confirmed < 2)
            {
                Debug.Log("[RematchManager] Impossible to get 2+ confirmed - cancelling");
                _timerActive = false;
                _isResolved = true;
                OnRematchCancelled?.Invoke();
            }
        }

        /// <summary>
        /// Resolves the rematch - either starts new game or returns to menu.
        /// </summary>
        private void ResolveRematch()
        {
            var confirmedPlayers = GetConfirmedPlayers();
            int confirmedCount = confirmedPlayers.Count;

            Debug.Log($"[RematchManager] Resolving rematch: {confirmedCount} confirmed players");

            if (confirmedCount >= 2)
            {
                OnRematchConfirmed?.Invoke(confirmedPlayers);
            }
            else
            {
                OnRematchCancelled?.Invoke();
            }
        }

        /// <summary>
        /// Resets the manager for a new game.
        /// </summary>
        public void Reset()
        {
            _playerStatuses.Clear();
            _timerActive = false;
            _timerStartTime = 0f;
            _isResolved = false;

            Debug.Log("[RematchManager] Reset");
        }
    }
}
