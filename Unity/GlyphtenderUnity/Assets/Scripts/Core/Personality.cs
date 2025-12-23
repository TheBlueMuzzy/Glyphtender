using System;

namespace Glyphtender.Core
{
    /// <summary>
    /// A trait with a range of possible values.
    /// Each turn, the AI rolls within this range (after situational shifts).
    /// </summary>
    public class TraitRange
    {
        public float Min { get; set; }
        public float Max { get; set; }

        public TraitRange(float min, float max)
        {
            Min = min;
            Max = max;
        }

        /// <summary>
        /// Creates a copy of this range.
        /// </summary>
        public TraitRange Clone()
        {
            return new TraitRange(Min, Max);
        }

        /// <summary>
        /// Shifts both bounds by an amount, clamped to 1-10.
        /// </summary>
        public void Shift(float amount)
        {
            Min = Clamp(Min + amount, 1f, 10f);
            Max = Clamp(Max + amount, 1f, 10f);

            // Ensure min <= max
            if (Min > Max)
            {
                float temp = Min;
                Min = Max;
                Max = temp;
            }
        }

        /// <summary>
        /// Shifts only the lower bound.
        /// </summary>
        public void ShiftMin(float amount)
        {
            Min = Clamp(Min + amount, 1f, 10f);
            if (Min > Max) Min = Max;
        }

        /// <summary>
        /// Shifts only the upper bound.
        /// </summary>
        public void ShiftMax(float amount)
        {
            Max = Clamp(Max + amount, 1f, 10f);
            if (Max < Min) Max = Min;
        }

        /// <summary>
        /// Rolls a value within this range.
        /// </summary>
        public float Roll(Random random)
        {
            return Min + (float)random.NextDouble() * (Max - Min);
        }

        private float Clamp(float value, float min, float max)
        {
            if (value < min) return min;
            if (value > max) return max;
            return value;
        }

        public override string ToString()
        {
            return $"[{Min:F1}, {Max:F1}]";
        }
    }

    /// <summary>
    /// Base personality traits as ranges.
    /// These define the personality's tendencies — the space of possibility.
    /// </summary>
    public class PersonalityTraitRanges
    {
        public TraitRange Aggression { get; set; }
        public TraitRange Greed { get; set; }
        public TraitRange Protectiveness { get; set; }
        public TraitRange Patience { get; set; }
        public TraitRange Spite { get; set; }
        public TraitRange Positional { get; set; }
        public TraitRange Cleverness { get; set; }
        public TraitRange Verbosity { get; set; }
        public TraitRange Opportunism { get; set; }
        public TraitRange RiskTolerance { get; set; }

        public PersonalityTraitRanges()
        {
            // Default: balanced ranges centered on 5
            Aggression = new TraitRange(4, 6);
            Greed = new TraitRange(4, 6);
            Protectiveness = new TraitRange(4, 6);
            Patience = new TraitRange(4, 6);
            Spite = new TraitRange(4, 6);
            Positional = new TraitRange(4, 6);
            Cleverness = new TraitRange(4, 6);
            Verbosity = new TraitRange(4, 6);
            Opportunism = new TraitRange(4, 6);
            RiskTolerance = new TraitRange(4, 6);
        }

        /// <summary>
        /// Creates a deep copy of all trait ranges.
        /// </summary>
        public PersonalityTraitRanges Clone()
        {
            return new PersonalityTraitRanges
            {
                Aggression = Aggression.Clone(),
                Greed = Greed.Clone(),
                Protectiveness = Protectiveness.Clone(),
                Patience = Patience.Clone(),
                Spite = Spite.Clone(),
                Positional = Positional.Clone(),
                Cleverness = Cleverness.Clone(),
                Verbosity = Verbosity.Clone(),
                Opportunism = Opportunism.Clone(),
                RiskTolerance = RiskTolerance.Clone()
            };
        }
    }

    /// <summary>
    /// Effective trait values for a single turn.
    /// Rolled from shifted ranges at turn start.
    /// </summary>
    public class EffectiveTraits
    {
        public float Aggression { get; set; }
        public float Greed { get; set; }
        public float Protectiveness { get; set; }
        public float Patience { get; set; }
        public float Spite { get; set; }
        public float Positional { get; set; }
        public float Cleverness { get; set; }
        public float Verbosity { get; set; }
        public float Opportunism { get; set; }
        public float RiskTolerance { get; set; }
    }

    /// <summary>
    /// Sub-traits that modify behavior patterns.
    /// These are fixed values, not ranges.
    /// </summary>
    public class SubTraits
    {
        /// <summary>
        /// How many turns ahead to consider (1-2 for mobile performance).
        /// </summary>
        public int PlanningHorizon { get; set; } = 1;

        /// <summary>
        /// Willingness to abandon current plan when better option appears (0-1).
        /// </summary>
        public float Flexibility { get; set; } = 0.5f;

        /// <summary>
        /// How "good enough" a hand feels before cycling (0-1).
        /// High = satisfied with mediocre hands.
        /// </summary>
        public float HandOptimism { get; set; } = 0.5f;

        /// <summary>
        /// When to shift focus to tangle victory (0-1).
        /// High = recognizes endgame early.
        /// </summary>
        public float EndgameAwareness { get; set; } = 0.5f;

        /// <summary>
        /// How much recent scoring trends affect behavior (0-1).
        /// </summary>
        public float MomentumSensitivity { get; set; } = 0.5f;
    }

    /// <summary>
    /// A complete AI personality with trait ranges, sub-traits,
    /// and the ability to roll effective traits each turn.
    /// </summary>
    public class Personality
    {
        public string Name { get; private set; }
        public string Description { get; private set; }

        /// <summary>
        /// Base trait ranges that define this personality (never modified).
        /// </summary>
        public PersonalityTraitRanges BaseRanges { get; private set; }

        /// <summary>
        /// Sub-traits that modify behavior patterns.
        /// </summary>
        public SubTraits SubTraits { get; private set; }

        /// <summary>
        /// Effective traits for the current turn.
        /// Rolled at turn start from situationally-shifted ranges.
        /// </summary>
        public EffectiveTraits EffectiveTraits { get; private set; }

        private Random _random;

        public Personality(string name, string description, PersonalityTraitRanges ranges, SubTraits subTraits, int? seed = null)
        {
            Name = name;
            Description = description;
            BaseRanges = ranges;
            SubTraits = subTraits;
            EffectiveTraits = new EffectiveTraits();
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
        }

        /// <summary>
        /// Rolls new effective traits for this turn.
        /// Call at the start of each AI turn.
        /// 
        /// Situational factors shift the trait ranges before rolling.
        /// Endgame has escalating influence — the closer to game end,
        /// the more survival pressure overrides base personality.
        /// </summary>
        public void RollEffectiveTraits(
            float perceivedLead,
            float myPressure,
            float opponentPressure,
            float handQuality,
            float momentum,
            float boardFillPercent)
        {
            // Start with a copy of base ranges
            var shifted = BaseRanges.Clone();

            // Calculate endgame multiplier (0 at start, 1 at 80%+ fill)
            float endgameMultiplier = 0f;
            if (boardFillPercent > 0.4f)
            {
                endgameMultiplier = (boardFillPercent - 0.4f) / 0.4f;  // 0 to 1
                endgameMultiplier *= SubTraits.EndgameAwareness;       // Scaled by awareness
            }

            // --- Score differential shifts ---
            if (perceivedLead < -20)
            {
                // Way behind: desperation shifts everything aggressive/risky
                shifted.Aggression.Shift(2);
                shifted.RiskTolerance.Shift(2);
                shifted.Patience.Shift(-2);
                shifted.Greed.ShiftMin(1);  // At least try for points
            }
            else if (perceivedLead < -10)
            {
                shifted.Aggression.Shift(1);
                shifted.RiskTolerance.Shift(1);
            }
            else if (perceivedLead > 20)
            {
                // Way ahead: can afford to be aggressive OR protective
                shifted.Protectiveness.ShiftMin(1);
                shifted.Aggression.ShiftMax(1);  // Can hunt if we want
                shifted.RiskTolerance.Shift(-1);  // Less need to gamble
            }
            else if (perceivedLead > 10)
            {
                shifted.Protectiveness.ShiftMin(0.5f);
            }

            // --- My glyphling pressure shifts ---
            if (myPressure >= 7)
            {
                // In danger: survival mode
                float urgency = 1 + endgameMultiplier;  // More urgent in endgame
                shifted.Protectiveness.Shift(2 * urgency);
                shifted.Aggression.ShiftMax(-1 * urgency);
                shifted.Positional.Shift(1.5f * urgency);
            }
            else if (myPressure >= 5)
            {
                shifted.Protectiveness.Shift(1);
                shifted.Aggression.ShiftMax(-0.5f);
            }

            // --- Opponent glyphling pressure shifts ---
            if (opponentPressure >= 7)
            {
                // They're nearly tangled: opportunity to finish
                float killInstinct = 1 + endgameMultiplier;
                shifted.Aggression.Shift(1.5f * killInstinct);
                shifted.Opportunism.ShiftMin(1);
                shifted.Greed.ShiftMax(-1);  // Points matter less than the kill
            }
            else if (opponentPressure >= 5)
            {
                shifted.Aggression.ShiftMin(0.5f);
            }

            // --- Hand quality shifts ---
            if (handQuality < 3)
            {
                // Bad hand: lower expectations
                shifted.Patience.Shift(-1.5f);
                shifted.Verbosity.ShiftMax(-1);
                shifted.Greed.ShiftMax(-1);
            }
            else if (handQuality > 7)
            {
                // Great hand: raise expectations
                shifted.Verbosity.ShiftMin(1);
                shifted.Cleverness.ShiftMin(0.5f);
                shifted.Greed.ShiftMin(0.5f);
            }

            // --- Momentum shifts (scaled by sensitivity) ---
            float momEffect = SubTraits.MomentumSensitivity;
            if (momentum > 2)
            {
                // On a roll
                shifted.Aggression.ShiftMin(1 * momEffect);
                shifted.RiskTolerance.ShiftMin(0.5f * momEffect);
            }
            else if (momentum < -2)
            {
                // They're rolling
                shifted.Protectiveness.ShiftMin(1 * momEffect);
                shifted.Spite.ShiftMin(0.5f * momEffect);
            }

            // --- Endgame shifts ---
            if (boardFillPercent > 0.6f)
            {
                shifted.Positional.Shift(1.5f * endgameMultiplier);
                shifted.Aggression.ShiftMin(1 * endgameMultiplier);
            }

            // --- Roll from shifted ranges ---
            EffectiveTraits.Aggression = shifted.Aggression.Roll(_random);
            EffectiveTraits.Greed = shifted.Greed.Roll(_random);
            EffectiveTraits.Protectiveness = shifted.Protectiveness.Roll(_random);
            EffectiveTraits.Patience = shifted.Patience.Roll(_random);
            EffectiveTraits.Spite = shifted.Spite.Roll(_random);
            EffectiveTraits.Positional = shifted.Positional.Roll(_random);
            EffectiveTraits.Cleverness = shifted.Cleverness.Roll(_random);
            EffectiveTraits.Verbosity = shifted.Verbosity.Roll(_random);
            EffectiveTraits.Opportunism = shifted.Opportunism.Roll(_random);
            EffectiveTraits.RiskTolerance = shifted.RiskTolerance.Roll(_random);
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
    /// Factory for creating preset personalities.
    /// Each has distinct trait ranges and can be countered.
    /// </summary>
    public static class PersonalityPresets
    {
        /// <summary>
        /// Timid: Consistently cautious. Tight ranges, always defensive.
        /// Weakness: Predictable, doesn't pressure.
        /// Counter: Aggressive play.
        /// </summary>
        public static Personality CreateTimid()
        {
            return new Personality(
                "Timid",
                "Cautious and defensive. Tight ranges, rarely takes risks.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(1, 3),
                    Greed = new TraitRange(2, 4),
                    Protectiveness = new TraitRange(8, 10),
                    Patience = new TraitRange(3, 5),
                    Spite = new TraitRange(1, 2),
                    Positional = new TraitRange(6, 8),
                    Cleverness = new TraitRange(3, 5),
                    Verbosity = new TraitRange(3, 5),
                    Opportunism = new TraitRange(2, 4),
                    RiskTolerance = new TraitRange(1, 3)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.7f,
                    HandOptimism = 0.6f,
                    EndgameAwareness = 0.3f,
                    MomentumSensitivity = 0.4f
                }
            );
        }

        /// <summary>
        /// Bully: Aggressive disruptor. Focused on blocking and trapping.
        /// Weakness: Ignores own scoring.
        /// Counter: Solid defense while outscoring.
        /// </summary>
        public static Personality CreateBully()
        {
            return new Personality(
                "Bully",
                "Aggressive disruptor. Blocks and traps over scoring.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(8, 10),
                    Greed = new TraitRange(3, 5),
                    Protectiveness = new TraitRange(2, 4),
                    Patience = new TraitRange(1, 3),
                    Spite = new TraitRange(7, 9),
                    Positional = new TraitRange(4, 6),
                    Cleverness = new TraitRange(3, 5),
                    Verbosity = new TraitRange(2, 4),
                    Opportunism = new TraitRange(5, 7),
                    RiskTolerance = new TraitRange(6, 8)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.4f,
                    HandOptimism = 0.5f,
                    EndgameAwareness = 0.7f,
                    MomentumSensitivity = 0.6f
                }
            );
        }

        /// <summary>
        /// Builder: Patient architect. Tight ranges, commits to plans.
        /// Weakness: Slow start, vulnerable to disruption.
        /// Counter: Steal their setups.
        /// </summary>
        public static Personality CreateBuilder()
        {
            return new Personality(
                "Builder",
                "Patient architect. Tight ranges, commits to elaborate setups.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(2, 4),
                    Greed = new TraitRange(6, 8),
                    Protectiveness = new TraitRange(5, 7),
                    Patience = new TraitRange(8, 10),
                    Spite = new TraitRange(1, 3),
                    Positional = new TraitRange(7, 9),
                    Cleverness = new TraitRange(6, 8),
                    Verbosity = new TraitRange(7, 9),
                    Opportunism = new TraitRange(3, 5),
                    RiskTolerance = new TraitRange(3, 5)
                },
                new SubTraits
                {
                    PlanningHorizon = 2,
                    Flexibility = 0.3f,  // Commits to plans
                    HandOptimism = 0.4f,
                    EndgameAwareness = 0.5f,
                    MomentumSensitivity = 0.3f
                }
            );
        }

        /// <summary>
        /// Opportunist: Reactive scavenger. Wide ranges, highly adaptable.
        /// Weakness: No long-term plan.
        /// Counter: Tight play that doesn't leave openings.
        /// </summary>
        public static Personality CreateOpportunist()
        {
            return new Personality(
                "Opportunist",
                "Reactive scavenger. Wide ranges, pounces on openings.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(4, 8),
                    Greed = new TraitRange(6, 10),
                    Protectiveness = new TraitRange(3, 7),
                    Patience = new TraitRange(1, 5),
                    Spite = new TraitRange(4, 8),
                    Positional = new TraitRange(2, 6),
                    Cleverness = new TraitRange(4, 8),
                    Verbosity = new TraitRange(3, 7),
                    Opportunism = new TraitRange(8, 10),
                    RiskTolerance = new TraitRange(4, 8)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.9f,  // Very adaptable
                    HandOptimism = 0.6f,
                    EndgameAwareness = 0.5f,
                    MomentumSensitivity = 0.7f
                }
            );
        }

        /// <summary>
        /// Balanced: Jack of all trades. Medium ranges centered at 5.
        /// Weakness: No standout strength.
        /// Counter: Any focused strategy.
        /// </summary>
        public static Personality CreateBalanced()
        {
            return new Personality(
                "Balanced",
                "Well-rounded generalist. Adapts without extremes.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(4, 6),
                    Greed = new TraitRange(4, 6),
                    Protectiveness = new TraitRange(4, 6),
                    Patience = new TraitRange(4, 6),
                    Spite = new TraitRange(4, 6),
                    Positional = new TraitRange(4, 6),
                    Cleverness = new TraitRange(4, 6),
                    Verbosity = new TraitRange(4, 6),
                    Opportunism = new TraitRange(4, 6),
                    RiskTolerance = new TraitRange(4, 6)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.5f,
                    HandOptimism = 0.5f,
                    EndgameAwareness = 0.5f,
                    MomentumSensitivity = 0.5f
                }
            );
        }

        /// <summary>
        /// Chaotic: Unpredictable wildcard. Very wide ranges.
        /// Weakness: Inconsistent, self-destructs.
        /// Counter: Steady play; let them beat themselves.
        /// </summary>
        public static Personality CreateChaotic()
        {
            return new Personality(
                "Chaotic",
                "Unpredictable wildcard. Very wide ranges, anything can happen.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(3, 10),
                    Greed = new TraitRange(2, 10),
                    Protectiveness = new TraitRange(1, 6),
                    Patience = new TraitRange(1, 4),
                    Spite = new TraitRange(3, 10),
                    Positional = new TraitRange(1, 5),
                    Cleverness = new TraitRange(2, 8),
                    Verbosity = new TraitRange(1, 8),
                    Opportunism = new TraitRange(4, 10),
                    RiskTolerance = new TraitRange(6, 10)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.9f,
                    HandOptimism = 0.7f,
                    EndgameAwareness = 0.3f,
                    MomentumSensitivity = 0.8f
                }
            );
        }

        /// <summary>
        /// Scholar: Word perfectionist. Tight high ranges for word skills.
        /// Weakness: Overthinks, misses simple moves.
        /// Counter: Fast simple plays.
        /// </summary>
        public static Personality CreateScholar()
        {
            return new Personality(
                "Scholar",
                "Word perfectionist. Seeks impressive long words and combos.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(3, 5),
                    Greed = new TraitRange(5, 7),
                    Protectiveness = new TraitRange(4, 6),
                    Patience = new TraitRange(6, 8),
                    Spite = new TraitRange(2, 4),
                    Positional = new TraitRange(3, 5),
                    Cleverness = new TraitRange(8, 10),
                    Verbosity = new TraitRange(8, 10),
                    Opportunism = new TraitRange(4, 6),
                    RiskTolerance = new TraitRange(3, 5)
                },
                new SubTraits
                {
                    PlanningHorizon = 2,
                    Flexibility = 0.4f,
                    HandOptimism = 0.3f,  // Very picky
                    EndgameAwareness = 0.4f,
                    MomentumSensitivity = 0.3f
                }
            );
        }

        /// <summary>
        /// Shark: Ruthless closer. Escalates as opponent weakens.
        /// Weakness: Overcommits to aggression.
        /// Counter: Bait into overextension.
        /// </summary>
        public static Personality CreateShark()
        {
            return new Personality(
                "Shark",
                "Ruthless closer. Smells blood and goes for the kill.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(6, 9),
                    Greed = new TraitRange(5, 8),
                    Protectiveness = new TraitRange(3, 5),
                    Patience = new TraitRange(4, 6),
                    Spite = new TraitRange(5, 8),
                    Positional = new TraitRange(5, 7),
                    Cleverness = new TraitRange(5, 7),
                    Verbosity = new TraitRange(5, 7),
                    Opportunism = new TraitRange(7, 9),
                    RiskTolerance = new TraitRange(5, 8)
                },
                new SubTraits
                {
                    PlanningHorizon = 2,
                    Flexibility = 0.6f,
                    HandOptimism = 0.5f,
                    EndgameAwareness = 0.8f,  // Knows when to finish
                    MomentumSensitivity = 0.7f
                }
            );
        }

        /// <summary>
        /// Gets a personality by name (case-insensitive).
        /// Returns Balanced if name not found.
        /// </summary>
        public static Personality GetByName(string name)
        {
            switch (name.ToLower())
            {
                case "timid": return CreateTimid();
                case "bully": return CreateBully();
                case "builder": return CreateBuilder();
                case "opportunist": return CreateOpportunist();
                case "balanced": return CreateBalanced();
                case "chaotic": return CreateChaotic();
                case "scholar": return CreateScholar();
                case "shark": return CreateShark();
                default: return CreateBalanced();
            }
        }

        /// <summary>
        /// Gets all available personality names.
        /// </summary>
        public static string[] GetAllNames()
        {
            return new string[]
            {
                "Timid", "Bully", "Builder", "Opportunist",
                "Balanced", "Chaotic", "Scholar", "Shark"
            };
        }
    }
}
