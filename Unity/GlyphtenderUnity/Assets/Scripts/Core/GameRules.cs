using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Handles all game rules: setup, move validation, and turn execution.
    /// Pure C# with no Unity dependencies.
    /// </summary>
    public static class GameRules
    {
        public const int HandSize = 8;
        public const int GlyphlingsPerPlayer = 2;

        // Standard letter distribution (120 tiles total, Qu as single tile)
        private static readonly Dictionary<char, int> LetterDistribution = new Dictionary<char, int>
        {
            {'A', 9}, {'B', 2}, {'C', 2}, {'D', 4}, {'E', 12}, {'F', 2},
            {'G', 3}, {'H', 2}, {'I', 9}, {'J', 1}, {'K', 1}, {'L', 4},
            {'M', 2}, {'N', 6}, {'O', 8}, {'P', 2}, {'Q', 1}, {'R', 6},
            {'S', 4}, {'T', 6}, {'U', 4}, {'V', 2}, {'W', 2}, {'X', 1},
            {'Y', 2}, {'Z', 1}
        };

        // Starting positions
        // Yellow: C4-8 and C8-3
        // Blue: C4-3 and C8-8
        public static readonly HexCoord[] YellowStartPositions =
        {
            new HexCoord(3, 7),   // C4-8
            new HexCoord(7, 2)    // C8-3
        };

        public static readonly HexCoord[] BlueStartPositions =
        {
            new HexCoord(3, 2),   // C4-3
            new HexCoord(7, 7)    // C8-8
        };

        /// <summary>
        /// Creates a new game with initial setup.
        /// </summary>
        public static GameState CreateNewGame(Random random = null)
        {
            random = random ?? new Random();
            var board = new Board();
            var state = new GameState(board);

            InitializeTileBag(state, random);
            PlaceStartingGlyphlings(state);
            DealInitialHands(state);

            return state;
        }

        private static void InitializeTileBag(GameState state, Random random)
        {
            foreach (var pair in LetterDistribution)
            {
                for (int i = 0; i < pair.Value; i++)
                {
                    state.TileBag.Add(pair.Key);
                }
            }

            // Fisher-Yates shuffle
            for (int i = state.TileBag.Count - 1; i > 0; i--)
            {
                int j = random.Next(i + 1);
                char temp = state.TileBag[i];
                state.TileBag[i] = state.TileBag[j];
                state.TileBag[j] = temp;
            }
        }

        private static void PlaceStartingGlyphlings(GameState state)
        {
            state.Glyphlings.Add(new Glyphling(Player.Yellow, 0, YellowStartPositions[0]));
            state.Glyphlings.Add(new Glyphling(Player.Yellow, 1, YellowStartPositions[1]));
            state.Glyphlings.Add(new Glyphling(Player.Blue, 0, BlueStartPositions[0]));
            state.Glyphlings.Add(new Glyphling(Player.Blue, 1, BlueStartPositions[1]));
        }

        private static void DealInitialHands(GameState state)
        {
            for (int i = 0; i < HandSize; i++)
            {
                DrawTile(state, Player.Yellow);
                DrawTile(state, Player.Blue);
            }
        }

        public static bool DrawTile(GameState state, Player player)
        {
            if (state.TileBag.Count == 0)
                return false;

            char tile = state.TileBag[state.TileBag.Count - 1];
            state.TileBag.RemoveAt(state.TileBag.Count - 1);
            state.Hands[player].Add(tile);
            return true;
        }

        public static List<HexCoord> GetValidMoves(GameState state, Glyphling glyphling)
        {
            var validMoves = new List<HexCoord>();

            for (int dir = 0; dir < 6; dir++)
            {
                var current = glyphling.Position;

                while (true)
                {
                    current = current.GetNeighbor(dir);

                    if (!state.Board.IsValidHex(current))
                        break;

                    if (state.HasTile(current) || state.HasGlyphling(current))
                        break;

                    validMoves.Add(current);
                }
            }

            return validMoves;
        }

        public static List<HexCoord> GetValidCastPositions(GameState state, Glyphling glyphling)
        {
            var validCasts = new List<HexCoord>();

            foreach (var neighbor in glyphling.Position.GetAllNeighbors())
            {
                if (state.Board.IsValidHex(neighbor) && state.IsEmpty(neighbor))
                {
                    validCasts.Add(neighbor);
                }
            }

            return validCasts;
        }

        public static bool ExecuteMove(GameState state, Glyphling glyphling,
            HexCoord destination, HexCoord castPosition, char letter)
        {
            if (glyphling.Owner != state.CurrentPlayer)
                return false;

            var validMoves = GetValidMoves(state, glyphling);
            if (!validMoves.Contains(destination))
                return false;

            glyphling.Position = destination;

            var validCasts = GetValidCastPositions(state, glyphling);
            if (!validCasts.Contains(castPosition))
                return false;

            if (!state.Hands[state.CurrentPlayer].Contains(letter))
                return false;

            state.Hands[state.CurrentPlayer].Remove(letter);
            state.Tiles[castPosition] = new Tile(letter, state.CurrentPlayer, castPosition);
            DrawTile(state, state.CurrentPlayer);

            return true;
        }

        public static void EndTurn(GameState state)
        {
            state.CurrentPlayer = state.CurrentPlayer == Player.Yellow
                ? Player.Blue
                : Player.Yellow;

            if (state.CurrentPlayer == Player.Yellow)
                state.TurnNumber++;
        }
    }
}