using System;
using System.Collections.Generic;
using System.Linq;

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

        /// <summary>
        /// Creates a new game with initial setup.
        /// </summary>
        public static GameState CreateNewGame(Random random = null)
        {
            return CreateNewGame(BoardSize.Medium, random);
        }

        /// <summary>
        /// Creates a new game with specified board size.
        /// </summary>
        public static GameState CreateNewGame(BoardSize boardSize, Random random = null)
        {
            random = random ?? new Random();
            var board = new Board(boardSize);
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
            var positions = GetStartingPositions(state.Board);

            state.Glyphlings.Add(new Glyphling(Player.Yellow, 0, positions.Yellow1));
            state.Glyphlings.Add(new Glyphling(Player.Yellow, 1, positions.Yellow2));
            state.Glyphlings.Add(new Glyphling(Player.Blue, 0, positions.Blue1));
            state.Glyphlings.Add(new Glyphling(Player.Blue, 1, positions.Blue2));
        }

        /// <summary>
        /// Calculates starting positions based on board size.
        /// Positions are symmetric: Yellow diagonal from top-left to bottom-right,
        /// Blue diagonal from bottom-left to top-right.
        /// </summary>
        public static (HexCoord Yellow1, HexCoord Yellow2, HexCoord Blue1, HexCoord Blue2) GetStartingPositions(Board board)
        {
            // Get interior hexes sorted by column then row
            var interiorHexes = board.InteriorHexes.ToList();

            // Find columns at roughly 1/4 and 3/4 of board width
            int leftCol = board.Columns / 4;
            int rightCol = board.Columns - 1 - (board.Columns / 4);

            // Get interior hexes in those columns
            var leftColumnHexes = interiorHexes
                .Where(h => h.Column == leftCol)
                .OrderBy(h => h.Row)
                .ToList();

            var rightColumnHexes = interiorHexes
                .Where(h => h.Column == rightCol)
                .OrderBy(h => h.Row)
                .ToList();

            // If columns don't have enough interior hexes, adjust
            if (leftColumnHexes.Count < 2)
            {
                leftCol++;
                leftColumnHexes = interiorHexes
                    .Where(h => h.Column == leftCol)
                    .OrderBy(h => h.Row)
                    .ToList();
            }

            if (rightColumnHexes.Count < 2)
            {
                rightCol--;
                rightColumnHexes = interiorHexes
                    .Where(h => h.Column == rightCol)
                    .OrderBy(h => h.Row)
                    .ToList();
            }

            // Pick positions near top and bottom of each column
            // Yellow: top-left and bottom-right
            // Blue: bottom-left and top-right
            var yellow1 = leftColumnHexes[leftColumnHexes.Count - 1];  // Top of left column
            var yellow2 = rightColumnHexes[0];                         // Bottom of right column
            var blue1 = leftColumnHexes[0];                            // Bottom of left column
            var blue2 = rightColumnHexes[rightColumnHexes.Count - 1];  // Top of right column

            return (yellow1, yellow2, blue1, blue2);
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

            // Check all 6 directions
            for (int dir = 0; dir < 6; dir++)
            {
                var current = glyphling.Position;

                while (true)
                {
                    current = current.GetNeighbor(dir);

                    // Stop if off board
                    if (!state.Board.IsBoardHex(current))
                        break;

                    // Stop if blocked by tile
                    if (state.HasTile(current))
                        break;

                    // Stop if blocked by another glyphling (not self)
                    var glyphlingAtPos = state.GetGlyphlingAt(current);
                    if (glyphlingAtPos != null && glyphlingAtPos != glyphling)
                        break;

                    // This is a valid move
                    validMoves.Add(current);
                }
            }

            return validMoves;
        }

        public static List<HexCoord> GetValidCastPositions(GameState state, Glyphling glyphling)
        {
            var validCasts = new List<HexCoord>();

            // Check all 6 directions along leylines
            for (int dir = 0; dir < 6; dir++)
            {
                var current = glyphling.Position;

                while (true)
                {
                    current = current.GetNeighbor(dir);

                    // Stop if off board
                    if (!state.Board.IsBoardHex(current))
                        break;

                    // Stop if blocked by opponent's tile
                    if (state.HasTile(current))
                    {
                        var tile = state.Tiles[current];
                        if (tile.Owner != glyphling.Owner)
                            break;
                        // Own tile - continue through it but can't cast here
                        continue;
                    }

                    // Stop if blocked by opponent's glyphling
                    var glyphlingAtPos = state.GetGlyphlingAt(current);
                    if (glyphlingAtPos != null)
                    {
                        if (glyphlingAtPos.Owner != glyphling.Owner)
                            break;
                        // Own glyphling - continue through it but can't cast here
                        continue;
                    }

                    // Empty space - valid cast position
                    validCasts.Add(current);
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