using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// A complete move the AI could make.
    /// </summary>
    public class AIMove
    {
        public Glyphling Glyphling { get; set; }
        public HexCoord Destination { get; set; }
        public HexCoord CastPosition { get; set; }
        public char Letter { get; set; }

        /// <summary>
        /// Creates a copy of this move.
        /// </summary>
        public AIMove Clone()
        {
            return new AIMove
            {
                Glyphling = Glyphling,
                Destination = Destination,
                CastPosition = CastPosition,
                Letter = Letter
            };
        }
    }

    /// <summary>
    /// The 7 goals an AI can pursue each turn.
    /// Each goal has an associated trait that controls its activation probability.
    /// </summary>
    public enum AIGoal
    {
        /// <summary>Corner an opponent glyphling, reduce their valid moves.</summary>
        Trap,

        /// <summary>Maximize points this turn.</summary>
        Score,

        /// <summary>Block opponent's opportunities (leylines, almost-words).</summary>
        Deny,

        /// <summary>Protect own glyphling, move to safer position.</summary>
        Escape,

        /// <summary>Create future word opportunities (gaps, extensions).</summary>
        Build,

        /// <summary>Complete words using mostly opponent tiles (ownership flip).</summary>
        Steal,

        /// <summary>Discard junk letters (Q without U, excess vowels).</summary>
        Dump
    }

    /// <summary>
    /// Maps goals to their controlling traits.
    /// </summary>
    public static class AIGoalTraitMap
    {
        public static AITrait GetTrait(AIGoal goal)
        {
            switch (goal)
            {
                case AIGoal.Trap: return AITrait.Aggression;
                case AIGoal.Score: return AITrait.Greed;
                case AIGoal.Deny: return AITrait.Spite;
                case AIGoal.Escape: return AITrait.Caution;
                case AIGoal.Build: return AITrait.Patience;
                case AIGoal.Steal: return AITrait.Opportunism;
                case AIGoal.Dump: return AITrait.Pragmatism;
                default: return AITrait.Greed;
            }
        }
    }

    /// <summary>
    /// The 7 traits that control goal activation probability.
    /// Each trait is on a 0-100 scale.
    /// </summary>
    public enum AITrait
    {
        Aggression,   // Controls TRAP
        Greed,        // Controls SCORE
        Spite,        // Controls DENY
        Caution,      // Controls ESCAPE
        Patience,     // Controls BUILD
        Opportunism,  // Controls STEAL
        Pragmatism    // Controls DUMP
    }

    /// <summary>
    /// Result of goal selection, including which goal was selected and why.
    /// </summary>
    public class GoalSelectionResult
    {
        public AIGoal SelectedGoal { get; set; }
        public bool WasFallback { get; set; }
        public int RollValue { get; set; }
        public int ThresholdValue { get; set; }
        public string Reasoning { get; set; }
    }

    /// <summary>
    /// Selects which goal the AI pursues this turn using priority cascade with trait rolls.
    ///
    /// How it works:
    /// 1. Personality defines a priority order of goals (e.g., Bully: TRAP > DENY > STEAL > ...)
    /// 2. For each goal in priority order:
    ///    a. Get the trait range for that goal (e.g., Aggression 80-95)
    ///    b. Roll a random value within that range (e.g., 87)
    ///    c. Roll d100 against that value
    ///    d. If roll <= value, goal activates - use this goal
    ///    e. If roll > value, goal fails - try next in priority
    /// 3. If ALL goals fail, auto-succeed on primary goal (first in priority)
    /// </summary>
    public class GoalSelector
    {
        private Random _random;

        public GoalSelector(int? seed = null)
        {
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
        }

        /// <summary>
        /// Selects a goal for this turn based on personality and current trait ranges.
        /// </summary>
        /// <param name="priorityOrder">Goals in priority order (first = primary)</param>
        /// <param name="traitRanges">Current trait ranges after situational shifts</param>
        /// <returns>The selected goal and selection details</returns>
        public GoalSelectionResult SelectGoal(
            AIGoal[] priorityOrder,
            Dictionary<AITrait, TraitRange> traitRanges)
        {
            if (priorityOrder == null || priorityOrder.Length == 0)
            {
                return new GoalSelectionResult
                {
                    SelectedGoal = AIGoal.Score,
                    WasFallback = true,
                    Reasoning = "No priority order defined, defaulting to Score"
                };
            }

            // Try each goal in priority order
            for (int i = 0; i < priorityOrder.Length; i++)
            {
                AIGoal goal = priorityOrder[i];
                AITrait trait = AIGoalTraitMap.GetTrait(goal);

                if (!traitRanges.TryGetValue(trait, out TraitRange range))
                {
                    // No range defined for this trait, skip
                    continue;
                }

                // Roll within the trait range to get threshold
                int threshold = (int)range.Roll(_random);

                // Roll d100 against threshold
                int roll = _random.Next(1, 101); // 1-100 inclusive

                if (roll <= threshold)
                {
                    // Goal activates!
                    return new GoalSelectionResult
                    {
                        SelectedGoal = goal,
                        WasFallback = false,
                        RollValue = roll,
                        ThresholdValue = threshold,
                        Reasoning = $"{goal} activated (rolled {roll} <= {threshold})"
                    };
                }
                // Goal failed, continue to next
            }

            // All goals failed - fallback to primary goal
            AIGoal primaryGoal = priorityOrder[0];
            return new GoalSelectionResult
            {
                SelectedGoal = primaryGoal,
                WasFallback = true,
                RollValue = 0,
                ThresholdValue = 0,
                Reasoning = $"All goals failed, falling back to primary: {primaryGoal}"
            };
        }

        /// <summary>
        /// Reseeds the random number generator.
        /// </summary>
        public void SetSeed(int seed)
        {
            _random = new Random(seed);
        }
    }

    /// <summary>
    /// A trait range on the 0-100 scale.
    /// Replaces the old 1-10 scale TraitRange.
    /// </summary>
    public class TraitRange
    {
        public float Min { get; set; }
        public float Max { get; set; }

        public TraitRange(float min, float max)
        {
            Min = Math.Max(0, Math.Min(100, min));
            Max = Math.Max(0, Math.Min(100, max));
            if (Min > Max)
            {
                float temp = Min;
                Min = Max;
                Max = temp;
            }
        }

        /// <summary>
        /// Creates a copy of this range.
        /// </summary>
        public TraitRange Clone()
        {
            return new TraitRange(Min, Max);
        }

        /// <summary>
        /// Shifts both bounds by an amount, clamped to 0-100.
        /// </summary>
        public void Shift(float amount)
        {
            Min = Clamp(Min + amount);
            Max = Clamp(Max + amount);
            EnsureOrder();
        }

        /// <summary>
        /// Shifts only the lower bound.
        /// </summary>
        public void ShiftMin(float amount)
        {
            Min = Clamp(Min + amount);
            if (Min > Max) Min = Max;
        }

        /// <summary>
        /// Shifts only the upper bound.
        /// </summary>
        public void ShiftMax(float amount)
        {
            Max = Clamp(Max + amount);
            if (Max < Min) Max = Min;
        }

        /// <summary>
        /// Narrows the range toward its center by a percentage (0-1).
        /// Used for higher difficulty = more consistent behavior.
        /// </summary>
        public void Narrow(float percent)
        {
            float center = (Min + Max) / 2f;
            float halfRange = (Max - Min) / 2f;
            float newHalfRange = halfRange * (1f - percent);
            Min = Clamp(center - newHalfRange);
            Max = Clamp(center + newHalfRange);
        }

        /// <summary>
        /// Widens the range from its center by a percentage (0-1).
        /// Used for lower difficulty = more variance.
        /// </summary>
        public void Widen(float percent)
        {
            float center = (Min + Max) / 2f;
            float halfRange = (Max - Min) / 2f;
            float newHalfRange = halfRange * (1f + percent);
            Min = Clamp(center - newHalfRange);
            Max = Clamp(center + newHalfRange);
        }

        /// <summary>
        /// Rolls a value within this range.
        /// </summary>
        public float Roll(Random random)
        {
            return Min + (float)random.NextDouble() * (Max - Min);
        }

        private float Clamp(float value)
        {
            if (value < 0) return 0;
            if (value > 100) return 100;
            return value;
        }

        private void EnsureOrder()
        {
            if (Min > Max)
            {
                float temp = Min;
                Min = Max;
                Max = temp;
            }
        }

        public override string ToString()
        {
            return $"[{Min:F0}-{Max:F0}]";
        }
    }
}
