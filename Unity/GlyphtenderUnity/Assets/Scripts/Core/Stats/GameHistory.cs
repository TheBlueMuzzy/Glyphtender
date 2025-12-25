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

        // Initial state (for replay from start)
        public List<char> InitialYellowHand;
        public List<char> InitialBlueHand;
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
            Moves = new List<MoveRecord>();
        }

        /// <summary>
        /// Creates a new game history with player info.
        /// </summary>
        public static GameHistory Create(PlayerInfo yellow, PlayerInfo blue, int randomSeed = 0)
        {
            return new GameHistory
            {
                YellowPlayer = yellow,
                BluePlayer = blue,
                RandomSeed = randomSeed
            };
        }

        /// <summary>
        /// Captures the initial hands for replay capability.
        /// Call this after dealing initial hands.
        /// </summary>
        public void CaptureInitialHands(List<char> yellowHand, List<char> blueHand)
        {
            InitialYellowHand = new List<char>(yellowHand);
            InitialBlueHand = new List<char>(blueHand);
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
        public bool IsVsAI => YellowPlayer?.IsAI == true || BluePlayer?.IsAI == true;

        /// <summary>
        /// Gets the AI personality if this was vs AI, null otherwise.
        /// </summary>
        public string AIPersonality =>
            YellowPlayer?.IsAI == true ? YellowPlayer.AIPersonality :
            BluePlayer?.IsAI == true ? BluePlayer.AIPersonality : null;
    }
}