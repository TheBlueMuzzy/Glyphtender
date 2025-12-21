using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Detects when glyphlings are "tangled" (unable to move).
    /// A tangled glyphling scores bonus points for the opponent based on adjacent pieces.
    /// Pure C# with no Unity dependencies.
    /// </summary>
    public static class TangleChecker
    {
        public const int TanglePointsPerAdjacent = 3;

        /// <summary>
        /// Checks if a glyphling is tangled (has no valid moves).
        /// </summary>
        public static bool IsTangled(GameState state, Glyphling glyphling)
        {
            var validMoves = GameRules.GetValidMoves(state, glyphling);
            return validMoves.Count == 0;
        }

        /// <summary>
        /// Gets all tangled glyphlings.
        /// </summary>
        public static List<Glyphling> GetTangledGlyphlings(GameState state)
        {
            var tangled = new List<Glyphling>();

            foreach (var glyphling in state.Glyphlings)
            {
                if (IsTangled(state, glyphling))
                {
                    tangled.Add(glyphling);
                }
            }

            return tangled;
        }

        /// <summary>
        /// Calculates and awards tangle points at end of game.
        /// You get 3 points for each of your tiles/glyphlings adjacent to a tangled enemy glyphling.
        /// </summary>
        public static Dictionary<Player, int> CalculateTanglePoints(GameState state)
        {
            var points = new Dictionary<Player, int>
            {
                { Player.Yellow, 0 },
                { Player.Blue, 0 }
            };

            var tangledGlyphlings = GetTangledGlyphlings(state);

            foreach (var tangled in tangledGlyphlings)
            {
                Player enemy = tangled.Owner;
                Player scorer = enemy == Player.Yellow ? Player.Blue : Player.Yellow;

                // Check all adjacent hexes
                foreach (var neighborCoord in tangled.Position.GetAllNeighbors())
                {
                    if (!state.Board.IsBoardHex(neighborCoord)) continue;

                    // Check for scorer's tile
                    if (state.Tiles.TryGetValue(neighborCoord, out Tile tile))
                    {
                        if (tile.Owner == scorer)
                        {
                            points[scorer] += TanglePointsPerAdjacent;
                        }
                    }

                    // Check for scorer's glyphling
                    var adjacentGlyphling = state.GetGlyphlingAt(neighborCoord);
                    if (adjacentGlyphling != null && adjacentGlyphling.Owner == scorer)
                    {
                        points[scorer] += TanglePointsPerAdjacent;
                    }
                }
            }

            return points;
        }

        /// <summary>
        /// Checks if the game should end (any two glyphlings are tangled).
        /// </summary>
        public static bool ShouldEndGame(GameState state)
        {
            var tangled = GetTangledGlyphlings(state);
            return tangled.Count >= 2;
        }
    }
}