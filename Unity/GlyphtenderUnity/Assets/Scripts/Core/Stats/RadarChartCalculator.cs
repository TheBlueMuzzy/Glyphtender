using System;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// Calculates radar chart values from lifetime stats.
    /// Two hemispheres: Wordsmith (spelling) and Tanglesmith (area control).
    /// </summary>
    public static class RadarChartCalculator
    {
        // Baseline expectations (tunable based on real player data)
        private const float ExpectedMultiWordRate = 0.20f;     // 20% of scoring turns
        private const float ExpectedPointsPerTile = 5.0f;      // Average points per tile placed
        private const float ExpectedInvestmentRate = 0.60f;    // 60% own tiles in words
        private const float ExpectedTanglesPerGame = 0.5f;     // Half a tangle per game
        private const float ExpectedBlockingRate = 0.25f;      // 25% of plays on opponent leylines
        private const float ExpectedWinRateWhenTangled = 0.40f;// 40% wins when you get tangled

        /// <summary>
        /// Creates a radar snapshot from current lifetime stats.
        /// </summary>
        public static RadarSnapshot CreateSnapshot(LifetimeStats lifetime)
        {
            var combined = CombineStats(lifetime.VsAI, lifetime.VsHuman);

            return new RadarSnapshot
            {
                GamesAtSnapshot = lifetime.TotalGames,
                TimestampUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),

                // Wordsmith hemisphere
                MultiWord = CalculateMultiWord(combined),
                Value = CalculateValue(combined),
                Investment = CalculateInvestment(combined),

                // Tanglesmith hemisphere
                Trapper = CalculateTrapper(combined),
                Aggression = CalculateAggression(combined),
                Resilience = CalculateResilience(combined)
            };
        }

        #region Wordsmith Calculations

        /// <summary>
        /// Multi-word: Ratio of multi-word turns to total scoring turns.
        /// High = sets up intersections and combo plays.
        /// </summary>
        private static float CalculateMultiWord(CombinedStats c)
        {
            long scoringTurns = c.TurnsPlayed - c.TurnsWithoutScoring;
            if (scoringTurns <= 0) return 0.5f;  // Default to middle if no data

            float rate = (float)c.MultiWordPlays / scoringTurns;
            return NormalizeWithBounds(rate, ExpectedMultiWordRate, 0f, 0.50f);
        }

        /// <summary>
        /// Value: Points scored per tile played.
        /// High = extracts maximum value from each letter.
        /// </summary>
        private static float CalculateValue(CombinedStats c)
        {
            if (c.TilesPlayed <= 0) return 0.5f;

            float pointsPerTile = (float)c.TotalPointsScored / c.TilesPlayed;
            return NormalizeWithBounds(pointsPerTile, ExpectedPointsPerTile, 2f, 10f);
        }

        /// <summary>
        /// Investment: Ratio of your tiles in scored words to total tiles in words.
        /// High = builds words primarily with own tiles (not piggy-backing).
        /// </summary>
        private static float CalculateInvestment(CombinedStats c)
        {
            if (c.TotalTilesInWords <= 0) return 0.5f;

            float rate = (float)c.OwnTilesInWords / c.TotalTilesInWords;
            return NormalizeWithBounds(rate, ExpectedInvestmentRate, 0.30f, 0.90f);
        }

        #endregion

        #region Tanglesmith Calculations

        /// <summary>
        /// Trapper: Tangles caused per game.
        /// High = actively hunts and traps opponents.
        /// </summary>
        private static float CalculateTrapper(CombinedStats c)
        {
            if (c.GamesPlayed <= 0) return 0.5f;

            float tanglesPerGame = (float)c.TanglesCaused / c.GamesPlayed;
            return NormalizeWithBounds(tanglesPerGame, ExpectedTanglesPerGame, 0f, 1.5f);
        }

        /// <summary>
        /// Aggression: Rate of plays on opponent leylines.
        /// High = constantly contests opponent space.
        /// </summary>
        private static float CalculateAggression(CombinedStats c)
        {
            if (c.TurnsPlayed <= 0) return 0.5f;

            long blockingPlays = c.CastsOnOpponentLeylines + c.MovesOnOpponentLeylines;
            // Each turn has 2 opportunities (move + cast), so divide by turns
            // This gives credit for either/both
            float rate = (float)blockingPlays / c.TurnsPlayed;
            return NormalizeWithBounds(rate, ExpectedBlockingRate, 0f, 0.70f);
        }

        /// <summary>
        /// Resilience: Win rate in games where your glyphlings got tangled.
        /// High = wins despite being trapped (strategic sacrifice or recovery).
        /// 
        /// Edge cases:
        /// - Never tangled (0 tangles): Returns 1.0 (perfect resilience)
        /// - Always tangled but never won: Returns 0.0
        /// - No games played: Returns 0.5 (neutral)
        /// </summary>
        private static float CalculateResilience(CombinedStats c)
        {
            if (c.GamesPlayed <= 0) return 0.5f;

            // If never tangled, that's perfect resilience
            if (c.GamesWhereYouWereTangled <= 0) return 1.0f;

            float winRateWhenTangled = (float)c.WinsWhileTangled / c.GamesWhereYouWereTangled;
            return NormalizeWithBounds(winRateWhenTangled, ExpectedWinRateWhenTangled, 0f, 0.80f);
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Normalizes a value to 0-1 range with configurable bounds.
        /// Values below min map to 0, above max map to 1.
        /// </summary>
        private static float NormalizeWithBounds(float value, float expected, float min, float max)
        {
            if (max <= min) return 0.5f;
            float normalized = (value - min) / (max - min);
            return Clamp(normalized);
        }

        private static float Clamp(float value)
        {
            return Math.Max(0f, Math.Min(1f, value));
        }

        /// <summary>
        /// Aggregates stats from both opponent type blocks.
        /// </summary>
        private static CombinedStats CombineStats(OpponentTypeStats ai, OpponentTypeStats human)
        {
            if (ai == null) ai = new OpponentTypeStats();
            if (human == null) human = new OpponentTypeStats();

            return new CombinedStats
            {
                GamesPlayed = ai.GamesPlayed + human.GamesPlayed,
                Wins = ai.Wins + human.Wins,
                TurnsPlayed = ai.TotalTurnsPlayed + human.TotalTurnsPlayed,
                TurnsWithoutScoring = ai.TotalTurnsWithoutScoring + human.TotalTurnsWithoutScoring,
                MultiWordPlays = ai.TotalMultiWordPlays + human.TotalMultiWordPlays,
                TotalPointsScored = ai.TotalPointsScored + human.TotalPointsScored,
                TilesPlayed = ai.TotalTilesPlayed + human.TotalTilesPlayed,
                OwnTilesInWords = ai.TotalOwnTilesInWords + human.TotalOwnTilesInWords,
                TotalTilesInWords = ai.TotalTilesInWords + human.TotalTilesInWords,
                TanglesCaused = ai.TotalTanglesCaused + human.TotalTanglesCaused,
                CastsOnOpponentLeylines = ai.TotalCastsOnOpponentLeylines + human.TotalCastsOnOpponentLeylines,
                MovesOnOpponentLeylines = ai.TotalMovesOnOpponentLeylines + human.TotalMovesOnOpponentLeylines,
                GamesWhereYouWereTangled = ai.GamesWhereYouWereTangled + human.GamesWhereYouWereTangled,
                WinsWhileTangled = ai.WinsWhileTangled + human.WinsWhileTangled
            };
        }

        #endregion

        /// <summary>
        /// Helper class aggregating stats from both opponent types.
        /// </summary>
        private class CombinedStats
        {
            public int GamesPlayed;
            public int Wins;
            public long TurnsPlayed;
            public int TurnsWithoutScoring;
            public int MultiWordPlays;
            public long TotalPointsScored;
            public int TilesPlayed;
            public int OwnTilesInWords;
            public int TotalTilesInWords;
            public int TanglesCaused;
            public int CastsOnOpponentLeylines;
            public int MovesOnOpponentLeylines;
            public int GamesWhereYouWereTangled;
            public int WinsWhileTangled;
        }
    }
}