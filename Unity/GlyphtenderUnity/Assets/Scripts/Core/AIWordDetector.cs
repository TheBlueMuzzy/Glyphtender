using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// A potential word opportunity or threat on the board.
    /// </summary>
    public class WordOpportunity
    {
        /// <summary>
        /// The pattern on the board (e.g., "HEL_" or "H_LP").
        /// </summary>
        public string Pattern { get; set; }

        /// <summary>
        /// The completed word if the gap is filled.
        /// </summary>
        public string CompletedWord { get; set; }

        /// <summary>
        /// The letter needed to complete the word.
        /// </summary>
        public char MissingLetter { get; set; }

        /// <summary>
        /// Position where the letter needs to go.
        /// </summary>
        public HexCoord GapPosition { get; set; }

        /// <summary>
        /// All positions involved in the word.
        /// </summary>
        public List<HexCoord> WordPositions { get; set; }

        /// <summary>
        /// Estimated points if completed.
        /// </summary>
        public int EstimatedValue { get; set; }

        /// <summary>
        /// Who owns most of the existing tiles (opportunity to steal or defend).
        /// </summary>
        public Player? MajorityOwner { get; set; }

        /// <summary>
        /// Is this an opportunity for the AI or a threat from opponent?
        /// </summary>
        public bool IsThreat { get; set; }
    }

    /// <summary>
    /// Detects word opportunities and threats on the board.
    /// Used for goal-directed AI search instead of brute force.
    /// </summary>
    public static class AIWordDetector
    {
        // Common letters that are likely to be in a player's hand
        private static readonly HashSet<char> CommonLetters = new HashSet<char>
        {
            'E', 'T', 'A', 'O', 'I', 'N', 'S', 'R', 'H', 'L', 'D', 'C', 'U', 'M', 'P', 'B', 'G', 'F', 'Y', 'W'
        };

        /// <summary>
        /// Finds all "almost-words" on the board — sequences one letter away from valid.
        /// </summary>
        public static List<WordOpportunity> FindAlmostWords(
            GameState state,
            HashSet<string> dictionary,
            Player aiPlayer)
        {
            var opportunities = new List<WordOpportunity>();
            var checkedPatterns = new HashSet<string>();

            // Check all leylines on the board
            foreach (var hex in state.Board.BoardHexes)
            {
                // Check 3 leyline directions (the other 3 are just reverse)
                for (int dir = 0; dir < 3; dir++)
                {
                    var leyline = GetLeyline(state.Board, hex, dir);
                    if (leyline.Count < 2) continue;

                    // Look for patterns with exactly one gap
                    var found = FindPatternsOnLeyline(leyline, state, dictionary, aiPlayer, checkedPatterns);
                    opportunities.AddRange(found);
                }
            }

            return opportunities;
        }

        /// <summary>
        /// Gets all hexes along a leyline in one direction.
        /// </summary>
        private static List<HexCoord> GetLeyline(Board board, HexCoord start, int direction)
        {
            var leyline = new List<HexCoord>();
            var current = start;

            while (board.IsBoardHex(current))
            {
                leyline.Add(current);
                current = current.GetNeighbor(direction);
            }

            return leyline;
        }

        /// <summary>
        /// Finds word patterns with one gap on a leyline.
        /// </summary>
        private static List<WordOpportunity> FindPatternsOnLeyline(
            List<HexCoord> leyline,
            GameState state,
            HashSet<string> dictionary,
            Player aiPlayer,
            HashSet<string> checkedPatterns)
        {
            var results = new List<WordOpportunity>();

            // Build sequence of (position, letter or null, owner or null)
            var sequence = new List<(HexCoord pos, char? letter, Player? owner)>();
            foreach (var pos in leyline)
            {
                if (state.Tiles.TryGetValue(pos, out var tile))
                {
                    sequence.Add((pos, tile.Letter, tile.Owner));
                }
                else if (state.GetGlyphlingAt(pos) == null)
                {
                    // Empty and no glyphling
                    sequence.Add((pos, null, null));
                }
                else
                {
                    // Has glyphling, can't place tile here
                    sequence.Add((pos, '!', null)); // Marker for blocked
                }
            }

            // Look at windows of 2-7 positions (reasonable word lengths)
            for (int length = 2; length <= Math.Min(7, sequence.Count); length++)
            {
                for (int start = 0; start <= sequence.Count - length; start++)
                {
                    var window = sequence.GetRange(start, length);

                    // Count letters and gaps
                    int letterCount = 0;
                    int gapCount = 0;
                    int blockedCount = 0;
                    int gapIndex = -1;

                    for (int i = 0; i < window.Count; i++)
                    {
                        if (window[i].letter == '!')
                            blockedCount++;
                        else if (window[i].letter == null)
                        {
                            gapCount++;
                            gapIndex = i;
                        }
                        else
                            letterCount++;
                    }

                    // We want exactly one gap, no blocked, at least 1 letter
                    if (gapCount != 1 || blockedCount > 0 || letterCount < 1)
                        continue;

                    // Build pattern string
                    var patternChars = new char[length];
                    var positions = new List<HexCoord>();
                    for (int i = 0; i < window.Count; i++)
                    {
                        positions.Add(window[i].pos);
                        patternChars[i] = window[i].letter ?? '_';
                    }
                    string pattern = new string(patternChars);

                    // Skip if already checked this exact pattern
                    string patternKey = $"{positions[0]}_{pattern}";
                    if (checkedPatterns.Contains(patternKey))
                        continue;
                    checkedPatterns.Add(patternKey);

                    // Try filling the gap with common letters
                    foreach (char fillLetter in CommonLetters)
                    {
                        var testChars = (char[])patternChars.Clone();
                        testChars[gapIndex] = fillLetter;
                        string candidate = new string(testChars);

                        if (dictionary.Contains(candidate.ToUpper()))
                        {
                            // Found a valid word!
                            var opportunity = CreateOpportunity(
                                pattern, candidate, fillLetter,
                                window, gapIndex, positions, aiPlayer);
                            results.Add(opportunity);
                        }
                    }
                }
            }

            return results;
        }

        /// <summary>
        /// Creates a WordOpportunity from the detected pattern.
        /// </summary>
        private static WordOpportunity CreateOpportunity(
            string pattern,
            string completedWord,
            char missingLetter,
            List<(HexCoord pos, char? letter, Player? owner)> window,
            int gapIndex,
            List<HexCoord> positions,
            Player aiPlayer)
        {
            // Count ownership
            int aiOwned = 0;
            int opponentOwned = 0;
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            foreach (var item in window)
            {
                if (item.owner == aiPlayer) aiOwned++;
                else if (item.owner == opponent) opponentOwned++;
            }

            // Determine majority owner
            Player? majorityOwner = null;
            if (aiOwned > opponentOwned) majorityOwner = aiPlayer;
            else if (opponentOwned > aiOwned) majorityOwner = opponent;

            // Calculate estimated value
            int wordLength = completedWord.Length;
            int ownershipBonus = (majorityOwner == aiPlayer) ? aiOwned + 1 : 1; // +1 for the letter we place
            int estimatedValue = wordLength + ownershipBonus;

            // Is this a threat (opponent's word we should block/steal) or opportunity?
            bool isThreat = majorityOwner == opponent;

            return new WordOpportunity
            {
                Pattern = pattern,
                CompletedWord = completedWord,
                MissingLetter = missingLetter,
                GapPosition = positions[gapIndex],
                WordPositions = positions,
                EstimatedValue = estimatedValue,
                MajorityOwner = majorityOwner,
                IsThreat = isThreat
            };
        }

        /// <summary>
        /// Filters opportunities to those the AI can actually reach.
        /// Returns only opportunities where the gap position is a valid cast 
        /// from a reachable glyphling position, and AI has the needed letter.
        /// </summary>
        public static List<WordOpportunity> FilterReachable(
            List<WordOpportunity> opportunities,
            GameState state,
            Player aiPlayer)
        {
            var reachable = new List<WordOpportunity>();
            var hand = state.Hands[aiPlayer];

            foreach (var opp in opportunities)
            {
                // Check if AI has the needed letter
                if (!hand.Contains(opp.MissingLetter))
                    continue;

                // Check if any AI glyphling can reach a position to cast to the gap
                bool canReach = false;
                foreach (var glyphling in state.Glyphlings)
                {
                    if (glyphling.Owner != aiPlayer) continue;
                    if (!glyphling.IsPlaced) continue;  // Skip unplaced glyphlings

                    // Get all positions this glyphling can move to (including current)
                    var movePositions = GameRules.GetValidMoves(state, glyphling);
                    movePositions.Add(glyphling.Position.Value); // Can also stay put (or already there)

                    foreach (var movePos in movePositions)
                    {
                        // Temporarily move glyphling to check cast positions
                        var originalPos = glyphling.Position;
                        glyphling.Position = movePos;

                        var castPositions = GameRules.GetValidCastPositions(state, glyphling);

                        glyphling.Position = originalPos; // Restore

                        if (castPositions.Contains(opp.GapPosition))
                        {
                            canReach = true;
                            break;
                        }
                    }

                    if (canReach) break;
                }

                if (canReach)
                {
                    reachable.Add(opp);
                }
            }

            return reachable;
        }

        /// <summary>
        /// Gets threats — opponent's almost-words that we might want to block or steal.
        /// </summary>
        public static List<WordOpportunity> GetThreats(
            List<WordOpportunity> opportunities)
        {
            var threats = new List<WordOpportunity>();
            foreach (var opp in opportunities)
            {
                if (opp.IsThreat)
                    threats.Add(opp);
            }
            return threats;
        }

        /// <summary>
        /// Gets steal opportunities — opponent's almost-words we could complete first.
        /// </summary>
        public static List<WordOpportunity> GetStealOpportunities(
            List<WordOpportunity> opportunities,
            GameState state,
            Player aiPlayer)
        {
            var steals = new List<WordOpportunity>();
            var hand = state.Hands[aiPlayer];

            foreach (var opp in opportunities)
            {
                // Must be opponent's word (threat) and we must have the letter
                if (opp.IsThreat && hand.Contains(opp.MissingLetter))
                {
                    steals.Add(opp);
                }
            }
            return steals;
        }

        /// <summary>
        /// Gets pure opportunities — words from our own tiles.
        /// </summary>
        public static List<WordOpportunity> GetOwnOpportunities(
            List<WordOpportunity> opportunities)
        {
            var own = new List<WordOpportunity>();
            foreach (var opp in opportunities)
            {
                if (!opp.IsThreat)
                    own.Add(opp);
            }
            return own;
        }
    }
}