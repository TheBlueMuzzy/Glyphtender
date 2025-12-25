using System.Collections.Generic;
using UnityEngine;
using Glyphtender.Core;
using Glyphtender.Core.Stats;

namespace Glyphtender.Unity.Stats
{
    /// <summary>
    /// Manages the current game's history during play.
    /// Creates MoveRecords, handles save/resume, and triggers stats calculation on game end.
    /// </summary>
    public class GameHistoryManager : MonoBehaviour
    {
        public static GameHistoryManager Instance { get; private set; }

        /// <summary>
        /// The current game's history. Null if no game in progress.
        /// </summary>
        public GameHistory CurrentHistory { get; private set; }

        /// <summary>
        /// The local player's lifetime stats.
        /// </summary>
        public LifetimeStats LocalPlayerStats { get; private set; }

        /// <summary>
        /// Stats from the most recently completed game. Available for end screen.
        /// </summary>
        public GameStats LastGameStats { get; private set; }

        // Local player info (would come from account system later)
        private const string LocalPlayerId = "LOCAL_PLAYER";
        private const string LocalPlayerName = "Player";

        // Tracking for current move (accumulated before RecordMove is called)
        private HexCoord? _moveFromPosition;
        private HexCoord? _moveToPosition;
        private int _moveGlyphlingIndex;
        private List<Glyphling> _tangledBeforeMove;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Load lifetime stats
            LocalPlayerStats = StatsPersistence.LoadLifetimeStats(LocalPlayerId, LocalPlayerName);
        }

        #region Game Lifecycle

        /// <summary>
        /// Starts tracking a new game.
        /// </summary>
        public void StartNewGame(PlayerInfo yellowPlayer, PlayerInfo bluePlayer, GameState initialState, int randomSeed = 0)
        {
            CurrentHistory = GameHistory.Create(yellowPlayer, bluePlayer, randomSeed);
            CurrentHistory.CaptureInitialHands(
                new List<char>(initialState.Hands[Player.Yellow]),
                new List<char>(initialState.Hands[Player.Blue])
            );

            // Save immediately
            StatsPersistence.SaveCurrentGame(CurrentHistory);

            Debug.Log($"Started new game: {CurrentHistory.GameId}");
        }

        /// <summary>
        /// Resumes a saved game.
        /// </summary>
        public GameHistory TryResumeGame()
        {
            if (!StatsPersistence.HasSavedGame())
                return null;

            CurrentHistory = StatsPersistence.LoadCurrentGame();
            if (CurrentHistory != null && CurrentHistory.IsInProgress)
            {
                Debug.Log($"Resumed game: {CurrentHistory.GameId} at turn {CurrentHistory.Moves.Count}");
                return CurrentHistory;
            }

            return null;
        }

        /// <summary>
        /// Ends the current game and calculates final stats.
        /// </summary>
        public GameStats EndGame(GameResult result)
        {
            if (CurrentHistory == null)
            {
                Debug.LogWarning("EndGame called but no game in progress");
                return null;
            }

            // Complete the history
            CurrentHistory.Complete(result);

            // Calculate stats
            LastGameStats = GameStatsCalculator.Calculate(CurrentHistory);

            // Update lifetime stats for local player
            Player localColor = CurrentHistory.YellowPlayer.IsAI ? Player.Blue : Player.Yellow;
            LifetimeStatsUpdater.UpdateFromGame(LocalPlayerStats, LastGameStats, localColor);

            // Save everything
            StatsPersistence.ArchiveGame(CurrentHistory);
            StatsPersistence.SaveLifetimeStats(LocalPlayerStats);
            StatsPersistence.DeleteCurrentGame();

            Debug.Log($"Game ended: {CurrentHistory.GameId}. Winner: {result.Winner}");

            CurrentHistory = null;

            return LastGameStats;
        }

        /// <summary>
        /// Abandons the current game without recording stats.
        /// </summary>
        public void AbandonGame()
        {
            if (CurrentHistory != null)
            {
                Debug.Log($"Abandoned game: {CurrentHistory.GameId}");
                StatsPersistence.DeleteCurrentGame();
                CurrentHistory = null;
            }
        }

        #endregion

        #region Move Recording

        /// <summary>
        /// Call before a move is executed to capture the "before" state.
        /// </summary>
        public void BeginMove(Glyphling glyphling, GameState state)
        {
            _moveFromPosition = glyphling.Position;
            _moveGlyphlingIndex = glyphling.Index;

            // Capture which glyphlings are already tangled
            _tangledBeforeMove = TangleChecker.GetTangledGlyphlings(state);
        }

        /// <summary>
        /// Call when glyphling destination is confirmed.
        /// </summary>
        public void SetMoveDestination(HexCoord destination)
        {
            _moveToPosition = destination;
        }

        /// <summary>
        /// Records a completed move to history.
        /// </summary>
        public void RecordMove(
            GameState state,
            Player player,
            HexCoord castPosition,
            char letter,
            List<WordResult> wordsFormed,
            int pointsEarned,
            bool enteredCycleMode,
            int tilesCycled)
        {
            if (CurrentHistory == null)
            {
                Debug.LogWarning("RecordMove called but no game in progress");
                return;
            }

            if (_moveFromPosition == null || _moveToPosition == null)
            {
                Debug.LogWarning("RecordMove called without BeginMove/SetMoveDestination");
                return;
            }

            var record = new MoveRecord
            {
                TurnNumber = state.TurnNumber,
                Player = player,
                GlyphlingIndex = _moveGlyphlingIndex,
                FromPosition = _moveFromPosition.Value,
                ToPosition = _moveToPosition.Value,
                CastPosition = castPosition,
                Letter = letter,
                PointsEarned = pointsEarned,
                EnteredCycleMode = enteredCycleMode,
                TilesCycled = tilesCycled,
                TimestampUtc = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),

                // Blocking detection
                CastOnOpponentLeyline = LeylineDetector.IsOnOpponentLeyline(state, castPosition, player),
                MovedOntoOpponentLeyline = LeylineDetector.IsOnOpponentLeyline(state, _moveToPosition.Value, player)
            };

            // Convert WordResults to WordScored
            if (wordsFormed != null)
            {
                foreach (var word in wordsFormed)
                {
                    // Calculate score using the static method
                    int ownTiles = CountOwnTiles(state, word.Positions, player);
                    int totalScore = word.Letters.Length + ownTiles; // Length + ownership bonus

                    var scored = new WordScored
                    {
                        Word = word.Letters,
                        LengthPoints = word.Letters.Length,
                        OwnershipPoints = ownTiles,
                        TotalPoints = totalScore,
                        Positions = new List<HexCoord>(word.Positions),
                        Direction = word.Direction,
                        TotalTilesInWord = word.Letters.Length,
                        OwnTilesInWord = ownTiles
                    };
                    record.WordsFormed.Add(scored);
                }
            }

            // Detect new tangles
            var tangledAfter = TangleChecker.GetTangledGlyphlings(state);
            foreach (var tangled in tangledAfter)
            {
                // Check if this is a NEW tangle (wasn't tangled before)
                bool wasAlreadyTangled = false;
                if (_tangledBeforeMove != null)
                {
                    foreach (var before in _tangledBeforeMove)
                    {
                        if (before.Owner == tangled.Owner && before.Index == tangled.Index)
                        {
                            wasAlreadyTangled = true;
                            break;
                        }
                    }
                }

                if (!wasAlreadyTangled)
                {
                    var tangleEvent = new TangleEvent
                    {
                        TangledPlayer = tangled.Owner,
                        GlyphlingIndex = tangled.Index,
                        Position = tangled.Position,
                        IsSelfTangle = (tangled.Owner == player) // You tangled your own glyphling
                    };
                    record.TangleEvents.Add(tangleEvent);
                }
            }

            // Add to history and save
            CurrentHistory.AddMove(record);
            StatsPersistence.SaveCurrentGame(CurrentHistory);

            // Clear tracking
            _moveFromPosition = null;
            _moveToPosition = null;
            _tangledBeforeMove = null;
        }

        /// <summary>
        /// Counts how many tiles in the given positions belong to the player.
        /// </summary>
        private int CountOwnTiles(GameState state, List<HexCoord> positions, Player player)
        {
            int count = 0;
            foreach (var pos in positions)
            {
                if (state.Tiles.TryGetValue(pos, out Tile tile))
                {
                    if (tile.Owner == player)
                        count++;
                }
            }
            return count;
        }

        #endregion

        #region Queries

        /// <summary>
        /// Returns true if there's a saved game that can be resumed.
        /// </summary>
        public bool CanResumeGame()
        {
            return StatsPersistence.HasSavedGame();
        }

        /// <summary>
        /// Gets the current game's move count.
        /// </summary>
        public int GetMoveCount()
        {
            return CurrentHistory?.Moves.Count ?? 0;
        }

        /// <summary>
        /// Gets a specific move from history.
        /// </summary>
        public MoveRecord GetMove(int index)
        {
            if (CurrentHistory == null || index < 0 || index >= CurrentHistory.Moves.Count)
                return null;
            return CurrentHistory.Moves[index];
        }

        #endregion

        #region Unity Lifecycle

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus && CurrentHistory != null)
            {
                // App going to background - ensure saved
                StatsPersistence.SaveCurrentGame(CurrentHistory);
                Debug.Log("Game saved on pause");
            }
        }

        private void OnApplicationQuit()
        {
            if (CurrentHistory != null)
            {
                StatsPersistence.SaveCurrentGame(CurrentHistory);
                Debug.Log("Game saved on quit");
            }
        }

        #endregion
    }
}