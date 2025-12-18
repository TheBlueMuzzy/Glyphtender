using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Detects when glyphlings are "tangled" (unable to move).
    /// A tangled glyphling scores bonus points for the opponent.
    /// Pure C# with no Unity dependencies.
    /// </summary>
    public static class TangleChecker
    {
        public const int TangleBonus = 10;

        /// <summary>
        /// Checks if a glyphling is tangled (has no valid moves).
        /// </summary>
        public static bool IsTangled(GameState state, Glyphling glyphling)
        {
            var validMoves = GameRules.GetValidMoves(state, glyphling);
            return validMoves.Count == 0;
        }

        /// <summary>
        /// Gets all tangled glyphlings for a player.
        /// </summary>
        public static List<Glyphling> GetTangledGlyphlings(GameState state, Player player)
        {
            var tangled = new List<Glyphling>();

            foreach (var glyphling in state.GetPlayerGlyphlings(player))
            {
                if (IsTangled(state, glyphling))
                {
                    tangled.Add(glyphling);
                }
            }

            return tangled;
        }

        /// <summary>
        /// Checks for newly tangled glyphlings and awards points.
        /// Call this after each move.
        /// Returns list of newly tangled glyphlings.
        /// </summary>
        public static List<Glyphling> CheckAndScoreTangles(GameState state)
        {
            var newlyTangled = new List<Glyphling>();

            // Check all glyphlings
            foreach (var glyphling in state.Glyphlings)
            {
                if (IsTangled(state, glyphling))
                {
                    newlyTangled.Add(glyphling);

                    // Award points to opponent
                    Player opponent = glyphling.Owner == Player.Yellow
                        ? Player.Blue
                        : Player.Yellow;
                    state.Scores[opponent] += TangleBonus;
                }
            }

            return newlyTangled;
        }

        /// <summary>
        /// Checks if a player has all glyphlings tangled.
        /// This could be a game-ending condition.
        /// </summary>
        public static bool AllGlyphlingsTangled(GameState state, Player player)
        {
            foreach (var glyphling in state.GetPlayerGlyphlings(player))
            {
                if (!IsTangled(state, glyphling))
                {
                    return false;
                }
            }
            return true;
        }

        /// <summary>
        /// Checks if the game should end due to tangle conditions.
        /// </summary>
        public static bool ShouldEndGame(GameState state)
        {
            // Game ends if both of a player's glyphlings are tangled
            return AllGlyphlingsTangled(state, Player.Yellow) ||
                   AllGlyphlingsTangled(state, Player.Blue);
        }
    }
}