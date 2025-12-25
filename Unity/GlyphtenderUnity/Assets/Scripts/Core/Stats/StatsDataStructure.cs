using System;
using System.Collections.Generic;

namespace Glyphtender.Core.Stats
{
    /// <summary>
    /// A word that was scored during a turn.
    /// </summary>
    [Serializable]
    public class WordScored
    {
        public string Word;
        public int LengthPoints;             // Points from word length
        public int OwnershipPoints;          // Points from owned tiles
        public int TotalPoints;              // LengthPoints + OwnershipPoints
        public List<HexCoord> Positions;     // Where the word is on board
        public int Direction;                // Leyline direction (0-5)

        // Investment tracking
        public int OwnTilesInWord;           // How many of YOUR tiles are in this word
        public int TotalTilesInWord;         // Total tiles in this word (word length)

        public WordScored()
        {
            Positions = new List<HexCoord>();
        }
    }

    /// <summary>
    /// Records a tangle event.
    /// </summary>
    [Serializable]
    public class TangleEvent
    {
        public Player TangledPlayer;         // Whose glyphling got tangled
        public int GlyphlingIndex;           // Which glyphling (0 or 1)
        public bool IsSelfTangle;            // Did they tangle themselves?
        public HexCoord Position;            // Where the tangle occurred
    }

    /// <summary>
    /// Records a single move. Enough data to reconstruct board state.
    /// </summary>
    [Serializable]
    public class MoveRecord
    {
        // Identity
        public int TurnNumber;
        public Player Player;

        // The Move
        public int GlyphlingIndex;           // Which glyphling (0 or 1)
        public HexCoord FromPosition;        // Where glyphling started
        public HexCoord ToPosition;          // Where glyphling moved to
        public HexCoord CastPosition;        // Where tile was placed
        public char Letter;                  // Letter that was cast

        // Results
        public List<WordScored> WordsFormed; // Words created this turn
        public int PointsEarned;             // Total points this turn
        public bool EnteredCycleMode;        // Did this trigger cycle mode?
        public int TilesCycled;              // How many tiles discarded (0 if no cycle)

        // Blocking behavior detection
        public bool CastOnOpponentLeyline;   // Was cast position on opponent's leyline?
        public bool MovedOntoOpponentLeyline;// Did glyphling move onto opponent's leyline?

        // Tangle events
        public List<TangleEvent> TangleEvents; // Any tangles caused this turn

        // Timestamp (for async play timeout tracking)
        public long TimestampUtc;            // Unix timestamp in milliseconds

        public MoveRecord()
        {
            WordsFormed = new List<WordScored>();
            TangleEvents = new List<TangleEvent>();
        }
    }

    /// <summary>
    /// Player identification for a game.
    /// </summary>
    [Serializable]
    public class PlayerInfo
    {
        public string PlayerId;              // Account ID (or "AI_{personality}" for AI)
        public string DisplayName;           // Shown in UI
        public bool IsAI;
        public string AIPersonality;         // Only if IsAI (e.g., "Tactician", "Builder")

        public PlayerInfo() { }

        public PlayerInfo(string playerId, string displayName, bool isAI = false, string aiPersonality = null)
        {
            PlayerId = playerId;
            DisplayName = displayName;
            IsAI = isAI;
            AIPersonality = aiPersonality;
        }

        /// <summary>
        /// Creates a PlayerInfo for an AI opponent.
        /// </summary>
        public static PlayerInfo CreateAI(string personality)
        {
            return new PlayerInfo(
                $"AI_{personality}",
                personality,
                isAI: true,
                aiPersonality: personality
            );
        }

        /// <summary>
        /// Creates a PlayerInfo for a local human player.
        /// </summary>
        public static PlayerInfo CreateLocalPlayer(string displayName = "Player")
        {
            return new PlayerInfo(
                $"LOCAL_{Guid.NewGuid():N}",
                displayName,
                isAI: false
            );
        }
    }

    /// <summary>
    /// Final game result.
    /// </summary>
    [Serializable]
    public class GameResult
    {
        public Player? Winner;               // Yellow, Blue, or null for tie
        public int YellowFinalScore;
        public int BlueFinalScore;
        public int YellowTanglePoints;       // End-game tangle bonus
        public int BlueTanglePoints;
        public int TotalTurns;
        public bool WasForfeited;            // Disconnection timeout
        public Player? ForfeitedBy;          // Who forfeited (if applicable)
    }
}