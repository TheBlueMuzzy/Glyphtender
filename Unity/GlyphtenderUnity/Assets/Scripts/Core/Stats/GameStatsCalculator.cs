using System;
using System.Collections.Generic;
using System.Linq;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// Calculates PlayerGameStats from a completed GameHistory.
    /// </summary>
    public static class GameStatsCalculator
    {
        /// <summary>
        /// Calculates complete game stats from a finished game history.
        /// </summary>
        public static GameStats Calculate(GameHistory history)
        {
            if (history.Result == null)
            {
                throw new InvalidOperationException("Cannot calculate stats for incomplete game");
            }

            var stats = new GameStats
            {
                GameId = history.GameId,
                GameEndTimeUtc = history.EndTimeUtc,
                WasVsAI = history.IsVsAI,
                AIPersonality = history.AIPersonality,
                Winner = history.Result.Winner,
                TotalTurns = history.Result.TotalTurns
            };

            stats.YellowStats = CalculatePlayerStats(history, Player.Yellow);
            stats.BlueStats = CalculatePlayerStats(history, Player.Blue);

            stats.TotalWordsOnBoard = stats.YellowStats.TotalWordsScored
                                    + stats.BlueStats.TotalWordsScored;

            return stats;
        }

        private static PlayerGameStats CalculatePlayerStats(GameHistory history, Player player)
        {
            var stats = new PlayerGameStats
            {
                PlayerId = player == Player.Yellow
                    ? history.YellowPlayer.PlayerId
                    : history.BluePlayer.PlayerId,
                Color = player
            };

            var uniqueWords = new HashSet<string>();
            int totalWordLength = 0;
            int totalWords = 0;

            foreach (var move in history.Moves)
            {
                if (move.Player != player) continue;

                stats.TotalTurns++;
                stats.TotalTilesPlayed++; // Every turn places one tile

                // Track letter
                if (!stats.LetterPlayCounts.ContainsKey(move.Letter))
                    stats.LetterPlayCounts[move.Letter] = 0;
                stats.LetterPlayCounts[move.Letter]++;

                // Track words
                if (move.WordsFormed == null || move.WordsFormed.Count == 0)
                {
                    stats.TurnsWithoutScoring++;
                }
                else
                {
                    if (move.WordsFormed.Count >= 2)
                        stats.MultiWordPlays++;

                    foreach (var word in move.WordsFormed)
                    {
                        totalWords++;
                        totalWordLength += word.Word.Length;
                        uniqueWords.Add(word.Word);

                        // Track investment
                        stats.OwnTilesInScoredWords += word.OwnTilesInWord;
                        stats.TotalTilesInScoredWords += word.TotalTilesInWord;

                        // Track word frequency
                        if (!stats.WordPlayCounts.ContainsKey(word.Word))
                            stats.WordPlayCounts[word.Word] = 0;
                        stats.WordPlayCounts[word.Word]++;

                        // Track longest
                        if (word.Word.Length > stats.LongestWordLength)
                        {
                            stats.LongestWord = word.Word;
                            stats.LongestWordLength = word.Word.Length;
                        }
                    }
                }

                // Track best turn
                if (move.PointsEarned > stats.BestScoringTurn)
                {
                    stats.BestScoringTurn = move.PointsEarned;
                    if (move.WordsFormed != null && move.WordsFormed.Count == 1)
                        stats.BestScoringWord = move.WordsFormed[0].Word;
                    else
                        stats.BestScoringWord = null; // Multiple words, no single "best word"
                }

                // Track cycling
                if (move.EnteredCycleMode)
                {
                    stats.TimesCycled++;
                    stats.TotalTilesCycled += move.TilesCycled;
                }

                // Track blocking
                if (move.CastOnOpponentLeyline)
                    stats.CastsOnOpponentLeylines++;
                if (move.MovedOntoOpponentLeyline)
                    stats.MovesOnOpponentLeylines++;

                // Track tangles
                if (move.TangleEvents != null)
                {
                    foreach (var tangle in move.TangleEvents)
                    {
                        if (tangle.TangledPlayer == player)
                        {
                            stats.TimesTangled++;
                            stats.WasTangledThisGame = true;
                            if (tangle.IsSelfTangle)
                                stats.SelfTangles++;
                        }
                        else
                        {
                            stats.TanglesCaused++;
                        }
                    }
                }
            }

            // Final calculations
            stats.TotalWordsScored = totalWords;
            stats.UniqueWordsScored = uniqueWords.Count;
            stats.AverageWordLength = totalWords > 0
                ? (float)totalWordLength / totalWords
                : 0f;

            // Final score from result
            stats.FinalScore = player == Player.Yellow
                ? history.Result.YellowFinalScore
                : history.Result.BlueFinalScore;
            stats.TanglePoints = player == Player.Yellow
                ? history.Result.YellowTanglePoints
                : history.Result.BlueTanglePoints;
            stats.WordPoints = stats.FinalScore - stats.TanglePoints;

            stats.PointsPerTurn = stats.TotalTurns > 0
                ? (float)stats.FinalScore / stats.TotalTurns
                : 0f;

            // Most played letter
            if (stats.LetterPlayCounts.Count > 0)
            {
                var top = stats.LetterPlayCounts.OrderByDescending(x => x.Value).First();
                stats.MostPlayedLetter = top.Key;
                stats.MostPlayedLetterCount = top.Value;
            }

            // Most played word
            if (stats.WordPlayCounts.Count > 0)
            {
                var top = stats.WordPlayCounts.OrderByDescending(x => x.Value).First();
                stats.MostPlayedWord = top.Key;
                stats.MostPlayedWordCount = top.Value;
            }

            return stats;
        }
    }
}