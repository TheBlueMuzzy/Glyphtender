using System;
using System.IO;
using UnityEngine;
using Glyphtender.Core.Stats;

namespace Glyphtender.Unity.Stats
{
    /// <summary>
    /// Handles persistence of stats data to local storage.
    /// Uses JSON serialization to Application.persistentDataPath.
    /// </summary>
    public static class StatsPersistence
    {
        // File paths
        private const string SaveFolder = "saves";
        private const string CurrentGameFile = "current_game.json";
        private const string LifetimeStatsFile = "lifetime_stats.json";
        private const string GameHistoryFolder = "game_history";

        /// <summary>
        /// Gets the full path to the saves folder.
        /// </summary>
        private static string SavePath => Path.Combine(Application.persistentDataPath, SaveFolder);

        /// <summary>
        /// Gets the full path to the game history archive folder.
        /// </summary>
        private static string HistoryPath => Path.Combine(SavePath, GameHistoryFolder);

        /// <summary>
        /// Ensures all required directories exist.
        /// </summary>
        public static void EnsureDirectories()
        {
            if (!Directory.Exists(SavePath))
                Directory.CreateDirectory(SavePath);
            if (!Directory.Exists(HistoryPath))
                Directory.CreateDirectory(HistoryPath);
        }

        #region Current Game (In-Progress)

        /// <summary>
        /// Saves the current in-progress game. Called after every move.
        /// </summary>
        public static void SaveCurrentGame(GameHistory history)
        {
            if (history == null) return;

            try
            {
                EnsureDirectories();
                string json = JsonUtility.ToJson(history, prettyPrint: false);
                string path = Path.Combine(SavePath, CurrentGameFile);
                File.WriteAllText(path, json);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save current game: {e.Message}");
            }
        }

        /// <summary>
        /// Loads the current in-progress game, if one exists.
        /// </summary>
        public static GameHistory LoadCurrentGame()
        {
            try
            {
                string path = Path.Combine(SavePath, CurrentGameFile);
                if (!File.Exists(path)) return null;

                string json = File.ReadAllText(path);
                return JsonUtility.FromJson<GameHistory>(json);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load current game: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Checks if there's a saved game in progress.
        /// </summary>
        public static bool HasSavedGame()
        {
            string path = Path.Combine(SavePath, CurrentGameFile);
            return File.Exists(path);
        }

        /// <summary>
        /// Deletes the current game save (called when game completes or user abandons).
        /// </summary>
        public static void DeleteCurrentGame()
        {
            try
            {
                string path = Path.Combine(SavePath, CurrentGameFile);
                if (File.Exists(path))
                    File.Delete(path);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to delete current game: {e.Message}");
            }
        }

        #endregion

        #region Completed Games (Archive)

        /// <summary>
        /// Archives a completed game to the history folder.
        /// </summary>
        public static void ArchiveGame(GameHistory history)
        {
            if (history == null || history.IsInProgress) return;

            try
            {
                EnsureDirectories();
                string json = JsonUtility.ToJson(history, prettyPrint: true);
                string filename = $"game_{history.GameId}.json";
                string path = Path.Combine(HistoryPath, filename);
                File.WriteAllText(path, json);

                Debug.Log($"Archived game {history.GameId}");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to archive game: {e.Message}");
            }
        }

        /// <summary>
        /// Loads a specific game from the archive by ID.
        /// </summary>
        public static GameHistory LoadArchivedGame(string gameId)
        {
            try
            {
                string filename = $"game_{gameId}.json";
                string path = Path.Combine(HistoryPath, filename);
                if (!File.Exists(path)) return null;

                string json = File.ReadAllText(path);
                return JsonUtility.FromJson<GameHistory>(json);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load archived game {gameId}: {e.Message}");
                return null;
            }
        }

        #endregion

        #region Lifetime Stats

        /// <summary>
        /// Saves lifetime stats.
        /// </summary>
        public static void SaveLifetimeStats(LifetimeStats stats)
        {
            if (stats == null) return;

            try
            {
                EnsureDirectories();
                string json = JsonUtility.ToJson(stats, prettyPrint: true);
                string path = Path.Combine(SavePath, LifetimeStatsFile);
                File.WriteAllText(path, json);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save lifetime stats: {e.Message}");
            }
        }

        /// <summary>
        /// Loads lifetime stats, or creates new if none exist.
        /// </summary>
        public static LifetimeStats LoadLifetimeStats(string playerId, string displayName)
        {
            try
            {
                string path = Path.Combine(SavePath, LifetimeStatsFile);
                if (File.Exists(path))
                {
                    string json = File.ReadAllText(path);
                    var stats = JsonUtility.FromJson<LifetimeStats>(json);

                    // Ensure dictionaries are initialized (JsonUtility doesn't serialize them well)
                    if (stats.AllTimeLetterCounts == null)
                        stats.AllTimeLetterCounts = new System.Collections.Generic.Dictionary<char, int>();
                    if (stats.AllTimeWordCounts == null)
                        stats.AllTimeWordCounts = new System.Collections.Generic.Dictionary<string, int>();
                    if (stats.RadarHistory == null)
                        stats.RadarHistory = new System.Collections.Generic.List<RadarSnapshot>();
                    if (stats.VsAI == null)
                        stats.VsAI = new OpponentTypeStats();
                    if (stats.VsHuman == null)
                        stats.VsHuman = new OpponentTypeStats();

                    return stats;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load lifetime stats: {e.Message}");
            }

            // Create new stats if none exist or load failed
            return LifetimeStats.Create(playerId, displayName);
        }

        /// <summary>
        /// Checks if lifetime stats exist.
        /// </summary>
        public static bool HasLifetimeStats()
        {
            string path = Path.Combine(SavePath, LifetimeStatsFile);
            return File.Exists(path);
        }

        #endregion

        #region Debug / Utility

        /// <summary>
        /// Deletes all saved data. Use for testing or reset.
        /// </summary>
        public static void DeleteAllData()
        {
            try
            {
                if (Directory.Exists(SavePath))
                    Directory.Delete(SavePath, recursive: true);
                Debug.Log("All stats data deleted");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to delete all data: {e.Message}");
            }
        }

        /// <summary>
        /// Gets the save path for debugging.
        /// </summary>
        public static string GetSavePath() => SavePath;

        #endregion
    }
}