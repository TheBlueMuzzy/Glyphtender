using System;
using System.Collections.Generic;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// Statistics for a single player in a single game.
    /// Calculated from GameHistory on game end.
    /// </summary>
    [Serializable]
    public class PlayerGameStats
    {
        // Identity
        public string PlayerId;
        public Player Color;

        // Score
        public int FinalScore;
        public int WordPoints;               // Points from words (excluding tangle)
        public int TanglePoints;             // End-game tangle bonus

        // Words
        public string LongestWord;
        public int LongestWordLength;
        public int BestScoringTurn;          // Highest single-turn points
        public string BestScoringWord;       // Word from best turn (if single word)
        public int TotalWordsScored;
        public int UniqueWordsScored;        // Distinct words (no repeats)
        public float AverageWordLength;
        public int MultiWordPlays;           // Turns with 2+ words scored

        // Investment (for radar chart)
        public int TotalTilesPlayed;         // How many tiles you cast this game
        public int OwnTilesInScoredWords;    // Your tiles that contributed to words
        public int TotalTilesInScoredWords;  // All tiles in your scored words

        // Efficiency
        public int TotalTurns;
        public float PointsPerTurn;
        public int TurnsWithoutScoring;

        // Cycling
        public int TotalTilesCycled;
        public int TimesCycled;              // Number of cycle mode entries

        // Tangles
        public int TimesTangled;             // How many of your glyphlings got tangled
        public int SelfTangles;              // Tangles caused by your own move
        public int TanglesCaused;            // Opponent glyphlings you tangled
        public bool WasTangledThisGame;      // Did any of your glyphlings get tangled?

        // Aggression / Blocking
        public int CastsOnOpponentLeylines;
        public int MovesOnOpponentLeylines;

        // Letter tracking
        public Dictionary<char, int> LetterPlayCounts;
        public char MostPlayedLetter;
        public int MostPlayedLetterCount;

        // Word tracking
        public Dictionary<string, int> WordPlayCounts;
        public string MostPlayedWord;
        public int MostPlayedWordCount;

        public PlayerGameStats()
        {
            LetterPlayCounts = new Dictionary<char, int>();
            WordPlayCounts = new Dictionary<string, int>();
        }
    }

    /// <summary>
    /// Complete stats for a finished game (both players).
    /// </summary>
    [Serializable]
    public class GameStats
    {
        public string GameId;
        public long GameEndTimeUtc;
        public bool WasVsAI;
        public string AIPersonality;         // If vs AI

        public PlayerGameStats YellowStats;
        public PlayerGameStats BlueStats;

        public Player? Winner;
        public int TotalTurns;
        public int TotalWordsOnBoard;        // Total words scored by both players

        /// <summary>
        /// Gets stats for a specific player color.
        /// </summary>
        public PlayerGameStats GetStatsForPlayer(Player player)
        {
            return player == Player.Yellow ? YellowStats : BlueStats;
        }
    }
}