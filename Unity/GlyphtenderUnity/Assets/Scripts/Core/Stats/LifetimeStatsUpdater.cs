using System.Linq;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// Updates LifetimeStats when a game completes.
    /// </summary>
    public static class LifetimeStatsUpdater
    {
        /// <summary>
        /// How often to create radar snapshots (every N games).
        /// </summary>
        public const int SnapshotInterval = 50;

        /// <summary>
        /// Updates lifetime stats from a completed game.
        /// </summary>
        /// <param name="lifetime">The player's lifetime stats to update</param>
        /// <param name="game">The completed game stats</param>
        /// <param name="playerColor">Which color the player was in this game</param>
        public static void UpdateFromGame(LifetimeStats lifetime, GameStats game, Player playerColor)
        {
            var playerStats = game.GetStatsForPlayer(playerColor);
            var targetBlock = game.WasVsAI ? lifetime.VsAI : lifetime.VsHuman;
            bool isWin = (game.Winner == playerColor);
            bool isTie = (game.Winner == null);

            // Update game counts
            targetBlock.GamesPlayed++;
            if (isWin)
                targetBlock.Wins++;
            else if (isTie)
                targetBlock.Ties++;
            else
                targetBlock.Losses++;

            // Update aggregates
            targetBlock.TotalPointsScored += playerStats.FinalScore;
            targetBlock.TotalTurnsPlayed += playerStats.TotalTurns;
            targetBlock.TotalWordsScored += playerStats.TotalWordsScored;
            targetBlock.TotalMultiWordPlays += playerStats.MultiWordPlays;
            targetBlock.TotalTilesCycled += playerStats.TotalTilesCycled;
            targetBlock.TotalTimesTangled += playerStats.TimesTangled;
            targetBlock.TotalSelfTangles += playerStats.SelfTangles;
            targetBlock.TotalTanglesCaused += playerStats.TanglesCaused;
            targetBlock.TotalTurnsWithoutScoring += playerStats.TurnsWithoutScoring;
            targetBlock.TotalCastsOnOpponentLeylines += playerStats.CastsOnOpponentLeylines;
            targetBlock.TotalMovesOnOpponentLeylines += playerStats.MovesOnOpponentLeylines;

            // Update investment tracking
            targetBlock.TotalTilesPlayed += playerStats.TotalTilesPlayed;
            targetBlock.TotalOwnTilesInWords += playerStats.OwnTilesInScoredWords;
            targetBlock.TotalTilesInWords += playerStats.TotalTilesInScoredWords;

            // Update resilience tracking
            if (playerStats.WasTangledThisGame)
            {
                targetBlock.GamesWhereYouWereTangled++;
                if (isWin)
                {
                    targetBlock.WinsWhileTangled++;
                }
            }

            // Update records (within opponent type)
            if (playerStats.FinalScore > targetBlock.HighestScore)
                targetBlock.HighestScore = playerStats.FinalScore;
            if (playerStats.LongestWordLength > targetBlock.LongestWordLength)
            {
                targetBlock.LongestWord = playerStats.LongestWord;
                targetBlock.LongestWordLength = playerStats.LongestWordLength;
            }
            if (playerStats.BestScoringTurn > targetBlock.BestScoringTurn)
                targetBlock.BestScoringTurn = playerStats.BestScoringTurn;

            // Update lifetime records (all games)
            if (playerStats.FinalScore > lifetime.HighestScore)
            {
                lifetime.HighestScore = playerStats.FinalScore;
                lifetime.HighestScoreGameId = game.GameId;
            }
            if (playerStats.LongestWordLength > lifetime.LongestWordLength)
            {
                lifetime.LongestWord = playerStats.LongestWord;
                lifetime.LongestWordLength = playerStats.LongestWordLength;
                lifetime.LongestWordGameId = game.GameId;
            }
            if (playerStats.BestScoringTurn > lifetime.BestScoringTurn)
            {
                lifetime.BestScoringTurn = playerStats.BestScoringTurn;
                lifetime.BestScoringTurnGameId = game.GameId;
            }

            // Update letter counts
            if (playerStats.LetterPlayCounts != null)
            {
                foreach (var kvp in playerStats.LetterPlayCounts)
                {
                    if (!lifetime.AllTimeLetterCounts.ContainsKey(kvp.Key))
                        lifetime.AllTimeLetterCounts[kvp.Key] = 0;
                    lifetime.AllTimeLetterCounts[kvp.Key] += kvp.Value;
                }

                if (lifetime.AllTimeLetterCounts.Count > 0)
                {
                    var top = lifetime.AllTimeLetterCounts.OrderByDescending(x => x.Value).First();
                    lifetime.FavoriteLetter = top.Key;
                }
            }

            // Update word counts
            if (playerStats.WordPlayCounts != null)
            {
                foreach (var kvp in playerStats.WordPlayCounts)
                {
                    if (!lifetime.AllTimeWordCounts.ContainsKey(kvp.Key))
                        lifetime.AllTimeWordCounts[kvp.Key] = 0;
                    lifetime.AllTimeWordCounts[kvp.Key] += kvp.Value;
                }

                if (lifetime.AllTimeWordCounts.Count > 0)
                {
                    var top = lifetime.AllTimeWordCounts.OrderByDescending(x => x.Value).First();
                    lifetime.FavoriteWord = top.Key;
                }

                lifetime.UniqueWordsEverPlayed = lifetime.AllTimeWordCounts.Count;
            }

            // Update timestamp
            lifetime.LastGameTimeUtc = game.GameEndTimeUtc;

            // Set first game time if not set
            if (lifetime.FirstGameTimeUtc == 0)
            {
                lifetime.FirstGameTimeUtc = game.GameEndTimeUtc;
            }

            // Check for radar snapshot (every N games)
            if (lifetime.TotalGames > 0 && lifetime.TotalGames % SnapshotInterval == 0)
            {
                var snapshot = RadarChartCalculator.CreateSnapshot(lifetime);
                lifetime.RadarHistory.Add(snapshot);
            }
        }
    }
}