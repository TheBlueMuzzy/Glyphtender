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
        /// Creates a new game with initial setup (no draft, backward compatible).
        /// </summary>
        public static GameState CreateNewGame(Random random = null)
        {
            return CreateNewGame(BoardSize.Medium, 2, random);
        }

        /// <summary>
        /// Creates a new game with specified board size and player count (no draft).
        /// </summary>
        public static GameState CreateNewGame(BoardSize boardSize, int playerCount = 2, Random random = null)
        {
            random = random ?? new Random();
            var board = new Board(boardSize);
            var state = new GameState(board, playerCount);

            InitializeTileBag(state, random);
            PlaceStartingGlyphlings(state);
            DealInitialHands(state);

            state.Phase = GamePhase.Play;
            return state;
        }

        /// <summary>
        /// Creates a new game with draft phase enabled.
        /// Glyphlings start unplaced, hands are dealt after draft completes.
        /// </summary>
        public static GameState CreateNewGameWithDraft(BoardSize boardSize, int playerCount = 2, Random random = null)
        {
            random = random ?? new Random();
            var board = new Board(boardSize);
            var state = new GameState(board, playerCount);

            InitializeTileBag(state, random);
            CreateUnplacedGlyphlings(state);
            // Don't deal hands yet - that happens after draft

            state.Phase = GamePhase.Draft;
            state.DraftPickNumber = 0;
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

        /// <summary>
        /// Creates glyphlings without placing them (for draft mode).
        /// </summary>
        private static void CreateUnplacedGlyphlings(GameState state)
        {
            foreach (var player in state.ActivePlayers)
            {
                for (int g = 0; g < GlyphlingsPerPlayer; g++)
                {
                    state.Glyphlings.Add(new Glyphling(player, g, null));
                }
            }
        }

        private static void PlaceStartingGlyphlings(GameState state)
        {
            var positions = GetStartingPositionsForPlayerCount(state.Board, state.PlayerCount);

            int posIndex = 0;
            foreach (var player in state.ActivePlayers)
            {
                for (int g = 0; g < GlyphlingsPerPlayer; g++)
                {
                    state.Glyphlings.Add(new Glyphling(player, g, positions[posIndex]));
                    posIndex++;
                }
            }
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

        /// <summary>
        /// Gets starting positions for all players based on player count.
        /// Distributes glyphlings around the board symmetrically.
        /// </summary>
        public static List<HexCoord> GetStartingPositionsForPlayerCount(Board board, int playerCount)
        {
            // For 2 players, use the existing diagonal layout
            if (playerCount == 2)
            {
                var pos = GetStartingPositions(board);
                return new List<HexCoord> { pos.Yellow1, pos.Yellow2, pos.Blue1, pos.Blue2 };
            }

            // For 3-4 players, distribute around the board
            var interiorHexes = board.InteriorHexes.ToList();
            var positions = new List<HexCoord>();

            // Calculate center from actual hex positions
            float centerCol = 0f;
            float centerRow = 0f;
            foreach (var hex in interiorHexes)
            {
                centerCol += hex.Column;
                centerRow += hex.Row;
            }
            centerCol /= interiorHexes.Count;
            centerRow /= interiorHexes.Count;

            // Calculate angle and distance for each hex
            var hexData = new List<HexAngleData>();
            foreach (var hex in interiorHexes)
            {
                float dCol = hex.Column - centerCol;
                float dRow = hex.Row - centerRow;
                double angle = Math.Atan2(dRow, dCol);
                double distance = Math.Sqrt(dCol * dCol + dRow * dRow);
                hexData.Add(new HexAngleData(hex, angle, distance));
            }

            // Each player gets 2 glyphlings in their "sector" of the board
            for (int p = 0; p < playerCount; p++)
            {
                // First glyphling: in player's "home" angle
                double angle1 = (2 * Math.PI * p / playerCount) - Math.PI;
                // Second glyphling: offset within same general area
                double angle2 = angle1 + (Math.PI / playerCount / 2);

                var pos1 = FindBestHexNearAngle(hexData, angle1, positions);
                positions.Add(pos1);

                var pos2 = FindBestHexNearAngle(hexData, angle2, positions);
                positions.Add(pos2);
            }

            return positions;
        }

        /// <summary>
        /// Helper struct to store hex position data for placement calculations.
        /// </summary>
        private struct HexAngleData
        {
            public HexCoord Hex;
            public double Angle;
            public double Distance;

            public HexAngleData(HexCoord hex, double angle, double distance)
            {
                Hex = hex;
                Angle = angle;
                Distance = distance;
            }
        }

        /// <summary>
        /// Finds the best hex near a target angle that isn't already taken.
        /// Prefers hexes at moderate distance from center.
        /// </summary>
        private static HexCoord FindBestHexNearAngle(
            List<HexAngleData> hexData,
            double targetAngle,
            List<HexCoord> takenPositions)
        {
            // Normalize target angle to [-PI, PI]
            targetAngle = NormalizeAngle(targetAngle);

            HexCoord bestHex = hexData[0].Hex;
            double bestScore = double.MaxValue;

            foreach (var data in hexData)
            {
                if (takenPositions.Contains(data.Hex))
                    continue;

                double angleDiff = Math.Abs(NormalizeAngle(data.Angle - targetAngle));
                // Score: balance angle match and moderate distance (prefer ~3 units from center)
                double score = angleDiff * 2 + Math.Abs(data.Distance - 3);

                if (score < bestScore)
                {
                    bestScore = score;
                    bestHex = data.Hex;
                }
            }

            return bestHex;
        }

        private static double NormalizeAngle(double angle)
        {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        }

        private static void DealInitialHands(GameState state)
        {
            for (int i = 0; i < HandSize; i++)
            {
                foreach (var player in state.ActivePlayers)
                {
                    DrawTile(state, player);
                }
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

            // Can't move if not placed
            if (!glyphling.IsPlaced)
                return validMoves;

            // Check all 6 directions
            for (int dir = 0; dir < 6; dir++)
            {
                var current = glyphling.Position.Value;

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

            // Can't cast if not placed
            if (!glyphling.IsPlaced)
                return validCasts;

            // Check all 6 directions along leylines
            for (int dir = 0; dir < 6; dir++)
            {
                var current = glyphling.Position.Value;

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

        /// <summary>
        /// Gets valid draft placement positions.
        /// Valid = interior hex (not edge), not adjacent to any placed glyphling.
        /// </summary>
        public static List<HexCoord> GetValidDraftPlacements(GameState state)
        {
            var validPlacements = new List<HexCoord>();

            foreach (var hex in state.Board.InteriorHexes)
            {
                // Skip if there's already a glyphling here
                if (state.HasGlyphling(hex))
                    continue;

                // Skip if adjacent to any placed glyphling
                bool adjacentToGlyphling = false;
                foreach (var neighbor in hex.GetAllNeighbors())
                {
                    if (state.HasGlyphling(neighbor))
                    {
                        adjacentToGlyphling = true;
                        break;
                    }
                }

                if (!adjacentToGlyphling)
                {
                    validPlacements.Add(hex);
                }
            }

            return validPlacements;
        }

        /// <summary>
        /// Places a glyphling during draft phase.
        /// Returns true if successful.
        /// </summary>
        public static bool PlaceDraftGlyphling(GameState state, HexCoord position)
        {
            if (state.Phase != GamePhase.Draft)
                return false;

            var validPlacements = GetValidDraftPlacements(state);
            if (!validPlacements.Contains(position))
                return false;

            // Find the next unplaced glyphling for the current drafter
            var glyphling = state.GetNextUnplacedGlyphling(state.CurrentDrafter);
            if (glyphling == null)
                return false;

            // Place it
            glyphling.Position = position;

            // Advance draft
            state.DraftPickNumber++;

            // Check if draft is complete
            if (state.AllGlyphlingsPlaced)
            {
                CompleteDraft(state);
            }

            return true;
        }

        /// <summary>
        /// Called when draft phase completes. Deals hands and transitions to Play phase.
        /// </summary>
        private static void CompleteDraft(GameState state)
        {
            DealInitialHands(state);
            state.Phase = GamePhase.Play;
            state.CurrentPlayer = Player.Yellow;  // Yellow always goes first in play phase
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
            int currentIndex = (int)state.CurrentPlayer;
            int nextIndex = (currentIndex + 1) % state.PlayerCount;
            state.CurrentPlayer = (Player)nextIndex;

            // Increment turn number when we wrap back to first player
            if (nextIndex == 0)
                state.TurnNumber++;
        }
    }
}