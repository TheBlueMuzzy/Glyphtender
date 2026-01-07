using System;
using System.Collections.Generic;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// Complete history of a game. Serializable to JSON for save/resume.
    /// </summary>
    [Serializable]
    public class GameHistory
    {
        // Game identity
        public string GameId;                // Unique identifier (GUID)
        public long StartTimeUtc;            // When game started
        public long EndTimeUtc;              // When game ended (0 if ongoing)

        // Players
        public PlayerInfo YellowPlayer;
        public PlayerInfo BluePlayer;
        public PlayerInfo PurplePlayer;
        public PlayerInfo PinkPlayer;
        public int PlayerCount;              // Number of players in this game (2-4)

        // Initial state (for replay from start)
        public List<char> InitialYellowHand;
        public List<char> InitialBlueHand;
        public List<char> InitialPurpleHand;
        public List<char> InitialPinkHand;
        public int RandomSeed;               // For tile bag reconstruction

        // Move history
        public List<MoveRecord> Moves;

        // Final state (populated on game end)
        public GameResult Result;

        public GameHistory()
        {
            GameId = Guid.NewGuid().ToString("N");
            StartTimeUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            InitialYellowHand = new List<char>();
            InitialBlueHand = new List<char>();
            InitialPurpleHand = new List<char>();
            InitialPinkHand = new List<char>();
            Moves = new List<MoveRecord>();
        }

        /// <summary>
        /// Creates a new game history with player info for all active players.
        /// </summary>
        public static GameHistory Create(List<PlayerInfo> players, int randomSeed = 0)
        {
            var history = new GameHistory
            {
                PlayerCount = players.Count,
                RandomSeed = randomSeed
            };

            if (players.Count > 0) history.YellowPlayer = players[0];
            if (players.Count > 1) history.BluePlayer = players[1];
            if (players.Count > 2) history.PurplePlayer = players[2];
            if (players.Count > 3) history.PinkPlayer = players[3];

            return history;
        }

        /// <summary>
        /// Captures the initial hands for replay capability.
        /// Call this after dealing initial hands.
        /// </summary>
        public void CaptureInitialHands(List<char> yellowHand, List<char> blueHand,
            List<char> purpleHand = null, List<char> pinkHand = null)
        {
            InitialYellowHand = yellowHand != null ? new List<char>(yellowHand) : new List<char>();
            InitialBlueHand = blueHand != null ? new List<char>(blueHand) : new List<char>();
            InitialPurpleHand = purpleHand != null ? new List<char>(purpleHand) : new List<char>();
            InitialPinkHand = pinkHand != null ? new List<char>(pinkHand) : new List<char>();
        }

        /// <summary>
        /// Adds a move to the history.
        /// </summary>
        public void AddMove(MoveRecord move)
        {
            Moves.Add(move);
        }

        /// <summary>
        /// Marks the game as complete with final result.
        /// </summary>
        public void Complete(GameResult result)
        {
            EndTimeUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            Result = result;
        }

        /// <summary>
        /// Returns true if this game is still in progress.
        /// </summary>
        public bool IsInProgress => EndTimeUtc == 0;

        /// <summary>
        /// Returns true if this was a game against AI.
        /// </summary>
        public bool IsVsAI =>
            YellowPlayer?.IsAI == true ||
            BluePlayer?.IsAI == true ||
            PurplePlayer?.IsAI == true ||
            PinkPlayer?.IsAI == true;

        /// <summary>
        /// Gets the AI personality if this was vs AI, null otherwise.
        /// Returns the first AI personality found.
        /// </summary>
        public string AIPersonality =>
            YellowPlayer?.IsAI == true ? YellowPlayer.AIPersonality :
            BluePlayer?.IsAI == true ? BluePlayer.AIPersonality :
            PurplePlayer?.IsAI == true ? PurplePlayer.AIPersonality :
            PinkPlayer?.IsAI == true ? PinkPlayer.AIPersonality : null;

        /// <summary>
        /// Gets the PlayerInfo for a specific player color.
        /// </summary>
        public PlayerInfo GetPlayerInfo(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return YellowPlayer;
                case Player.Blue: return BluePlayer;
                case Player.Purple: return PurplePlayer;
                case Player.Pink: return PinkPlayer;
                default: return null;
            }
        }
    }
}