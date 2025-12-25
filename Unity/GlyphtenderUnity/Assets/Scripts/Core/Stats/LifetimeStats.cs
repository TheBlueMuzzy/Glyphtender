using System;
using System.Collections.Generic;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// Stats against a specific opponent type (AI or Human).
    /// </summary>
    [Serializable]
    public class OpponentTypeStats
    {
        // Game counts
        public int GamesPlayed;
        public int Wins;
        public int Losses;
        public int Ties;

        // Aggregated totals
        public long TotalPointsScored;
        public long TotalTurnsPlayed;
        public int TotalWordsScored;
        public int TotalMultiWordPlays;
        public int TotalTilesCycled;
        public int TotalTimesTangled;
        public int TotalSelfTangles;
        public int TotalTanglesCaused;
        public int TotalTurnsWithoutScoring;
        public int TotalCastsOnOpponentLeylines;
        public int TotalMovesOnOpponentLeylines;

        // Investment tracking (for radar chart)
        public int TotalTilesPlayed;          // Total tiles cast across all games
        public int TotalOwnTilesInWords;      // Your tiles that were part of scored words
        public int TotalTilesInWords;         // All tiles (yours + opponent's) in scored words

        // Resilience tracking (for radar chart)
        public int GamesWhereYouWereTangled;  // Games where at least one of your glyphlings was tangled
        public int WinsWhileTangled;          // Wins in games where you were tangled

        // Records within this category
        public int HighestScore;
        public string LongestWord;
        public int LongestWordLength;
        public int BestScoringTurn;

        // Computed properties
        public float WinRate => GamesPlayed > 0 ? (float)Wins / GamesPlayed : 0f;

        public float AvgPointsPerGame => GamesPlayed > 0
            ? (float)TotalPointsScored / GamesPlayed
            : 0f;

        public float AvgPointsPerTurn => TotalTurnsPlayed > 0
            ? (float)TotalPointsScored / TotalTurnsPlayed
            : 0f;

        public float AvgTilesCycledPerGame => GamesPlayed > 0
            ? (float)TotalTilesCycled / GamesPlayed
            : 0f;
    }

    /// <summary>
    /// A point-in-time snapshot of radar chart values.
    /// Two hemispheres: Wordsmith (spelling) and Tanglesmith (area control).
    /// </summary>
    [Serializable]
    public class RadarSnapshot
    {
        public int GamesAtSnapshot;          // Total games when snapshot taken
        public long TimestampUtc;

        // Wordsmith hemisphere (0.0 to 1.0)
        public float MultiWord;              // Multi-word plays rate
        public float Value;                  // Points per tile efficiency
        public float Investment;             // Own-tile usage in words

        // Tanglesmith hemisphere (0.0 to 1.0)
        public float Trapper;                // Tangles caused per game
        public float Aggression;             // Blocking play rate
        public float Resilience;             // Win rate when tangled
    }

    /// <summary>
    /// Aggregated stats across all games for a single player.
    /// Split by opponent type (AI vs Human).
    /// </summary>
    [Serializable]
    public class LifetimeStats
    {
        public string PlayerId;
        public string DisplayName;

        // Separate stat blocks
        public OpponentTypeStats VsAI;
        public OpponentTypeStats VsHuman;

        // Lifetime records (across all games)
        public int HighestScore;
        public string HighestScoreGameId;
        public string LongestWord;
        public int LongestWordLength;
        public string LongestWordGameId;
        public int BestScoringTurn;
        public string BestScoringTurnGameId;

        // Lifetime favorites
        public Dictionary<char, int> AllTimeLetterCounts;
        public char FavoriteLetter;
        public Dictionary<string, int> AllTimeWordCounts;
        public string FavoriteWord;
        public int UniqueWordsEverPlayed;

        // Radar chart snapshots (every 50 games)
        public List<RadarSnapshot> RadarHistory;

        // Metadata
        public long FirstGameTimeUtc;
        public long LastGameTimeUtc;
        public int CurrentVersion;           // For migration support

        // Computed properties
        public int TotalGames => (VsAI?.GamesPlayed ?? 0) + (VsHuman?.GamesPlayed ?? 0);
        public int TotalWins => (VsAI?.Wins ?? 0) + (VsHuman?.Wins ?? 0);
        public int TotalLosses => (VsAI?.Losses ?? 0) + (VsHuman?.Losses ?? 0);
        public float OverallWinRate => TotalGames > 0 ? (float)TotalWins / TotalGames : 0f;

        public LifetimeStats()
        {
            VsAI = new OpponentTypeStats();
            VsHuman = new OpponentTypeStats();
            AllTimeLetterCounts = new Dictionary<char, int>();
            AllTimeWordCounts = new Dictionary<string, int>();
            RadarHistory = new List<RadarSnapshot>();
            CurrentVersion = 1;
        }

        /// <summary>
        /// Creates a new LifetimeStats for a player.
        /// </summary>
        public static LifetimeStats Create(string playerId, string displayName)
        {
            return new LifetimeStats
            {
                PlayerId = playerId,
                DisplayName = displayName,
                FirstGameTimeUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
        }
    }
}