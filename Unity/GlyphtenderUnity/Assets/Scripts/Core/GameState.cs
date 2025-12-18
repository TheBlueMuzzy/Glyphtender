using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    public enum Player
    {
        Yellow,
        Blue
    }

    /// <summary>
    /// A letter tile placed on the board.
    /// </summary>
    public class Tile
    {
        public char Letter { get; }
        public Player Owner { get; }
        public HexCoord Position { get; }

        public Tile(char letter, Player owner, HexCoord position)
        {
            Letter = letter;
            Owner = owner;
            Position = position;
        }
    }

    /// <summary>
    /// A glyphling piece that moves and casts tiles.
    /// </summary>
    public class Glyphling
    {
        public Player Owner { get; }
        public HexCoord Position { get; set; }
        public int Index { get; } // 0 or 1 (each player has 2)

        public Glyphling(Player owner, int index, HexCoord startPosition)
        {
            Owner = owner;
            Index = index;
            Position = startPosition;
        }
    }

    /// <summary>
    /// Complete game state - all data needed to represent a game in progress.
    /// Pure C# with no Unity dependencies.
    /// </summary>
    public class GameState
    {
        // Board reference
        public Board Board { get; }

        // Tiles on the board (position -> tile)
        public Dictionary<HexCoord, Tile> Tiles { get; }

        // All four glyphlings
        public List<Glyphling> Glyphlings { get; }

        // Player hands (7 tiles each)
        public Dictionary<Player, List<char>> Hands { get; }

        // Tile bag
        public List<char> TileBag { get; }

        // Scores
        public Dictionary<Player, int> Scores { get; }

        // Current turn
        public Player CurrentPlayer { get; set; }

        // Turn number
        public int TurnNumber { get; set; }

        // Game over flag
        public bool IsGameOver { get; set; }

        public GameState(Board board)
        {
            Board = board;
            Tiles = new Dictionary<HexCoord, Tile>();
            Glyphlings = new List<Glyphling>();
            Hands = new Dictionary<Player, List<char>>
            {
                { Player.Yellow, new List<char>() },
                { Player.Blue, new List<char>() }
            };
            TileBag = new List<char>();
            Scores = new Dictionary<Player, int>
            {
                { Player.Yellow, 0 },
                { Player.Blue, 0 }
            };
            CurrentPlayer = Player.Yellow;
            TurnNumber = 1;
            IsGameOver = false;
        }

        /// <summary>
        /// Gets glyphlings belonging to a specific player.
        /// </summary>
        public IEnumerable<Glyphling> GetPlayerGlyphlings(Player player)
        {
            foreach (var g in Glyphlings)
            {
                if (g.Owner == player)
                    yield return g;
            }
        }

        /// <summary>
        /// Gets the glyphling at a position, or null if none.
        /// </summary>
        public Glyphling GetGlyphlingAt(HexCoord position)
        {
            foreach (var g in Glyphlings)
            {
                if (g.Position == position)
                    return g;
            }
            return null;
        }

        /// <summary>
        /// Checks if a hex is occupied by a tile.
        /// </summary>
        public bool HasTile(HexCoord position)
        {
            return Tiles.ContainsKey(position);
        }

        /// <summary>
        /// Checks if a hex is occupied by a glyphling.
        /// </summary>
        public bool HasGlyphling(HexCoord position)
        {
            return GetGlyphlingAt(position) != null;
        }

        /// <summary>
        /// Checks if a hex is empty (no tile, no glyphling).
        /// </summary>
        public bool IsEmpty(HexCoord position)
        {
            return !HasTile(position) && !HasGlyphling(position);
        }
    }
}