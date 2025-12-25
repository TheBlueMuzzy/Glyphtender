using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Detects when positions lie on opponent-controlled leylines.
    /// Used for tracking blocking behavior in stats.
    /// </summary>
    public static class LeylineDetector
    {
        /// <summary>
        /// Checks if a hex position lies on any leyline currently occupied by opponent glyphlings.
        /// A leyline is "occupied" by a glyphling if the glyphling sits on that line.
        /// </summary>
        /// <param name="state">Current game state</param>
        /// <param name="position">Position to check</param>
        /// <param name="currentPlayer">The player making the move</param>
        /// <returns>True if position is on any opponent glyphling's leyline</returns>
        public static bool IsOnOpponentLeyline(GameState state, HexCoord position, Player currentPlayer)
        {
            Player opponent = currentPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            foreach (var glyphling in state.GetPlayerGlyphlings(opponent))
            {
                if (IsOnGlyphlingLeyline(state.Board, glyphling.Position, position))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Checks if a target position lies on any leyline extending from a glyphling position.
        /// </summary>
        private static bool IsOnGlyphlingLeyline(Board board, HexCoord glyphlingPos, HexCoord targetPos)
        {
            // Check all 6 leyline directions from the glyphling
            for (int dir = 0; dir < 6; dir++)
            {
                var leyline = board.GetLeyline(glyphlingPos, dir);
                foreach (var hex in leyline)
                {
                    if (hex == targetPos)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Gets all opponent glyphlings whose leylines pass through the given position.
        /// Useful for detailed blocking analysis.
        /// </summary>
        public static List<Glyphling> GetBlockedGlyphlings(GameState state, HexCoord position, Player currentPlayer)
        {
            var blocked = new List<Glyphling>();
            Player opponent = currentPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            foreach (var glyphling in state.GetPlayerGlyphlings(opponent))
            {
                if (IsOnGlyphlingLeyline(state.Board, glyphling.Position, position))
                {
                    blocked.Add(glyphling);
                }
            }

            return blocked;
        }

        /// <summary>
        /// Counts how many opponent glyphling leylines pass through the given position.
        /// Higher count = more valuable blocking position.
        /// </summary>
        public static int CountBlockedLeylines(GameState state, HexCoord position, Player currentPlayer)
        {
            int count = 0;
            Player opponent = currentPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            foreach (var glyphling in state.GetPlayerGlyphlings(opponent))
            {
                // Count each direction separately - a position could block multiple leylines from same glyphling
                for (int dir = 0; dir < 6; dir++)
                {
                    var leyline = state.Board.GetLeyline(glyphling.Position, dir);
                    foreach (var hex in leyline)
                    {
                        if (hex == position)
                        {
                            count++;
                            break; // Found on this leyline, check next direction
                        }
                    }
                }
            }

            return count;
        }
    }
}