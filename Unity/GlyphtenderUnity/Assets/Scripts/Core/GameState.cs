using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    public enum Player
    {
        Yellow = 0,
        Blue = 1,
        Purple = 2,
        Pink = 3
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

        /// <summary>
        /// Creates a copy of this glyphling.
        /// </summary>
        public Glyphling Clone()
        {
            return new Glyphling(Owner, Index, Position);
        }
    }

    /// <summary>
    /// Complete game state - all data needed to represent a game in progress.
    /// Pure C# with no Unity dependencies.
    /// </summary>
    public class GameState
    {
        // Board reference (immutable, shared between clones)
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

        // Number of players in this game (2-4)
        public int PlayerCount { get; }

        /// <summary>
        /// Returns the players active in this game.
        /// </summary>
        public IEnumerable<Player> ActivePlayers
        {
            get
            {
                for (int i = 0; i < PlayerCount; i++)
                {
                    yield return (Player)i;
                }
            }
        }

        public GameState(Board board, int playerCount = 2)
        {
            Board = board;
            PlayerCount = playerCount;
            Tiles = new Dictionary<HexCoord, Tile>();
            Glyphlings = new List<Glyphling>();
            Hands = new Dictionary<Player, List<char>>();
            for (int i = 0; i < playerCount; i++)
            {
                Hands[(Player)i] = new List<char>();
            }
            TileBag = new List<char>();
            Scores = new Dictionary<Player, int>();
            for (int i = 0; i < playerCount; i++)
            {
                Scores[(Player)i] = 0;
            }
            CurrentPlayer = Player.Yellow;
            TurnNumber = 1;
            IsGameOver = false;
        }

        /// <summary>
        /// Private constructor for cloning.
        /// </summary>
        private GameState(Board board, int playerCount, bool forClone)
        {
            Board = board;
            PlayerCount = playerCount;
            Tiles = new Dictionary<HexCoord, Tile>();
            Glyphlings = new List<Glyphling>();
            Hands = new Dictionary<Player, List<char>>();
            TileBag = new List<char>();
            Scores = new Dictionary<Player, int>();
        }

        /// <summary>
        /// Creates a deep copy of the game state for AI simulation.
        /// The Board is shared (immutable), everything else is copied.
        /// </summary>
        public GameState Clone()
        {
            var clone = new GameState(Board, PlayerCount, forClone: true);

            // Copy tiles (Tile is immutable, so we can reuse the same objects)
            foreach (var kvp in Tiles)
            {
                clone.Tiles[kvp.Key] = kvp.Value;
            }

            // Copy glyphlings (need new instances since Position is mutable)
            foreach (var g in Glyphlings)
            {
                clone.Glyphlings.Add(g.Clone());
            }

            // Copy hands (need new lists)
            foreach (var player in ActivePlayers)
            {
                clone.Hands[player] = new List<char>(Hands[player]);
            }

            // Copy tile bag
            clone.TileBag.AddRange(TileBag);

            // Copy scores
            foreach (var player in ActivePlayers)
            {
                clone.Scores[player] = Scores[player];
            }

            // Copy value types
            clone.CurrentPlayer = CurrentPlayer;
            clone.TurnNumber = TurnNumber;
            clone.IsGameOver = IsGameOver;

            return clone;
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