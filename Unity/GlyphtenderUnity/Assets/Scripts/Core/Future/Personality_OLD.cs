using System;

namespace Glyphtender.Core
{
    /// <summary>
    /// AI difficulty levels affecting trait consistency and power.
    /// </summary>
    public enum AIDifficulty
    {
        Apprentice,  // Easy - wider ranges, lower average
        FirstClass,  // Medium - baseline
        Archmage     // Hard - tighter ranges, higher average
    }

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
        /// Shifts both bounds by an amount, clamped to trait bounds.
        /// </summary>
        public void Shift(float amount)
        {
            Min = Clamp(Min + amount, AIConstants.TraitMin, AIConstants.TraitMax);
            Max = Clamp(Max + amount, AIConstants.TraitMin, AIConstants.TraitMax);

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
            Min = Clamp(Min + amount, AIConstants.TraitMin, AIConstants.TraitMax);
            if (Min > Max) Min = Max;
        }

        /// <summary>
        /// Shifts only the upper bound.
        /// </summary>
        public void ShiftMax(float amount)
        {
            Max = Clamp(Max + amount, AIConstants.TraitMin, AIConstants.TraitMax);
            if (Max < Min) Max = Min;
        }

        /// <summary>
        /// Applies difficulty scaling to this range.
        /// </summary>
        public void ApplyDifficulty(AIDifficulty difficulty)
        {
            float center = (Min + Max) / 2f;
            float halfRange = (Max - Min) / 2f;

            switch (difficulty)
            {
                case AIDifficulty.Apprentice:
                    halfRange *= AIConstants.ApprenticeRangeMultiplier;
                    center += AIConstants.ApprenticeCenterShift;
                    break;
                case AIDifficulty.FirstClass:
                    // No change
                    break;
                case AIDifficulty.Archmage:
                    halfRange *= AIConstants.ArchmageRangeMultiplier;
                    center += AIConstants.ArchmageCenterShift;
                    break;
            }

            Min = Clamp(center - halfRange, AIConstants.TraitMin, AIConstants.TraitMax);
            Max = Clamp(center + halfRange, AIConstants.TraitMin, AIConstants.TraitMax);

            if (Min > Max)
            {
                float temp = Min;
                Min = Max;
                Max = temp;
            }
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
        public TraitRange TrapFocus { get; set; }
        public TraitRange DenialFocus { get; set; }
        public TraitRange SetupFocus { get; set; }

        public PersonalityTraitRanges()
        {
            // Default: balanced ranges centered on 5
            float min = AIConstants.DefaultTraitRangeMin;
            float max = AIConstants.DefaultTraitRangeMax;

            Aggression = new TraitRange(min, max);
            Greed = new TraitRange(min, max);
            Protectiveness = new TraitRange(min, max);
            Patience = new TraitRange(min, max);
            Spite = new TraitRange(min, max);
            Positional = new TraitRange(min, max);
            Cleverness = new TraitRange(min, max);
            Verbosity = new TraitRange(min, max);
            Opportunism = new TraitRange(min, max);
            RiskTolerance = new TraitRange(min, max);
            TrapFocus = new TraitRange(min, max);
            DenialFocus = new TraitRange(min, max);
            SetupFocus = new TraitRange(min, max);
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
                RiskTolerance = RiskTolerance.Clone(),
                TrapFocus = TrapFocus.Clone(),
                DenialFocus = DenialFocus.Clone(),
                SetupFocus = SetupFocus.Clone()
            };
        }

        /// <summary>
        /// Applies difficulty scaling to all trait ranges.
        /// </summary>
        public void ApplyDifficulty(AIDifficulty difficulty)
        {
            Aggression.ApplyDifficulty(difficulty);
            Greed.ApplyDifficulty(difficulty);
            Protectiveness.ApplyDifficulty(difficulty);
            Patience.ApplyDifficulty(difficulty);
            Spite.ApplyDifficulty(difficulty);
            Positional.ApplyDifficulty(difficulty);
            Cleverness.ApplyDifficulty(difficulty);
            Verbosity.ApplyDifficulty(difficulty);
            Opportunism.ApplyDifficulty(difficulty);
            RiskTolerance.ApplyDifficulty(difficulty);
            TrapFocus.ApplyDifficulty(difficulty);
            DenialFocus.ApplyDifficulty(difficulty);
            SetupFocus.ApplyDifficulty(difficulty);
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
        public float TrapFocus { get; set; }
        public float DenialFocus { get; set; }
        public float SetupFocus { get; set; }
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

        /// <summary>
        /// How AI reacts to opponent's good plays.
        /// -1 = demoralizes (lowers bounds), +1 = rallies (raises bounds), 0 = stoic
        /// </summary>
        public float MoraleDirection { get; set; } = 0f;

        /// <summary>
        /// How strongly morale affects trait bounds (0-1).
        /// 0 = stoic (no effect), 1 = volatile (big swings)
        /// </summary>
        public float MoraleSensitivity { get; set; } = 0.5f;
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
        /// Gets the morale multiplier based on opponent's last score.
        /// </summary>
        private float GetMoraleMultiplier(int lastOpponentScore)
        {
            if (lastOpponentScore >= AIConstants.MoraleScoreAmplified)
                return AIConstants.MoraleMultiplierAmplified;
            if (lastOpponentScore >= AIConstants.MoraleScoreFull)
                return AIConstants.MoraleMultiplierFull;
            if (lastOpponentScore >= AIConstants.MoraleScoreMinor)
                return AIConstants.MoraleMultiplierMinor;
            return 0f;
        }

        /// <summary>
        /// Applies morale shift to a trait range.
        /// </summary>
        private void ApplyMorale(TraitRange range, float moraleMultiplier)
        {
            if (moraleMultiplier == 0f || SubTraits.MoraleSensitivity == 0f)
                return;

            float shift = moraleMultiplier * SubTraits.MoraleSensitivity * SubTraits.MoraleDirection;
            range.Shift(shift);
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
            float boardFillPercent,
            AIDifficulty difficulty = AIDifficulty.FirstClass,
            int lastOpponentScore = 0)
        {
            // Start with a copy of base ranges
            var shifted = BaseRanges.Clone();

            // Apply difficulty scaling first
            shifted.ApplyDifficulty(difficulty);

            // Apply morale shifts
            float moraleMultiplier = GetMoraleMultiplier(lastOpponentScore);
            ApplyMorale(shifted.Aggression, moraleMultiplier);
            ApplyMorale(shifted.Greed, moraleMultiplier);
            ApplyMorale(shifted.Protectiveness, moraleMultiplier);
            ApplyMorale(shifted.Patience, moraleMultiplier);
            ApplyMorale(shifted.Spite, moraleMultiplier);
            ApplyMorale(shifted.Positional, moraleMultiplier);
            ApplyMorale(shifted.Cleverness, moraleMultiplier);
            ApplyMorale(shifted.Verbosity, moraleMultiplier);
            ApplyMorale(shifted.Opportunism, moraleMultiplier);
            ApplyMorale(shifted.RiskTolerance, moraleMultiplier);
            ApplyMorale(shifted.TrapFocus, moraleMultiplier);
            ApplyMorale(shifted.DenialFocus, moraleMultiplier);
            ApplyMorale(shifted.SetupFocus, moraleMultiplier);

            // Calculate endgame multiplier (0 at start, 1 at 80%+ fill)
            float endgameMultiplier = 0f;
            if (boardFillPercent > AIConstants.BoardFillEndgameStart)
            {
                endgameMultiplier = (boardFillPercent - AIConstants.BoardFillEndgameStart) / AIConstants.BoardFillEndgameStart;
                endgameMultiplier *= SubTraits.EndgameAwareness;
            }

            // --- Score differential shifts ---
            if (perceivedLead < AIConstants.LeadWayBehind)
            {
                // Way behind: desperation shifts everything aggressive/risky
                shifted.Aggression.Shift(AIConstants.ShiftLarge);
                shifted.RiskTolerance.Shift(AIConstants.ShiftLarge);
                shifted.Patience.Shift(-AIConstants.ShiftLarge);
                shifted.Greed.ShiftMin(AIConstants.ShiftStandard);
            }
            else if (perceivedLead < AIConstants.LeadBehind)
            {
                shifted.Aggression.Shift(AIConstants.ShiftStandard);
                shifted.RiskTolerance.Shift(AIConstants.ShiftStandard);
            }
            else if (perceivedLead > AIConstants.LeadWayAhead)
            {
                // Way ahead: can afford to be aggressive OR protective
                shifted.Protectiveness.ShiftMin(AIConstants.ShiftStandard);
                shifted.Aggression.ShiftMax(AIConstants.ShiftStandard);
                shifted.RiskTolerance.Shift(-AIConstants.ShiftStandard);
            }
            else if (perceivedLead > AIConstants.LeadAhead)
            {
                shifted.Protectiveness.ShiftMin(AIConstants.ShiftSmall);
            }

            // --- My glyphling pressure shifts ---
            if (myPressure >= AIConstants.PressureCritical)
            {
                // In danger: survival mode
                float urgency = 1 + endgameMultiplier;
                shifted.Protectiveness.Shift(AIConstants.ShiftLarge * urgency);
                shifted.Aggression.ShiftMax(-AIConstants.ShiftStandard * urgency);
                shifted.Positional.Shift(AIConstants.ShiftMedium * urgency);
            }
            else if (myPressure >= AIConstants.PressureElevated)
            {
                shifted.Protectiveness.Shift(AIConstants.ShiftStandard);
                shifted.Aggression.ShiftMax(-AIConstants.ShiftSmall);
            }

            // --- Opponent glyphling pressure shifts ---
            if (opponentPressure >= AIConstants.PressureCritical)
            {
                // They're nearly tangled: opportunity to finish
                float killInstinct = 1 + endgameMultiplier;
                shifted.Aggression.Shift(AIConstants.ShiftMedium * killInstinct);
                shifted.Opportunism.ShiftMin(AIConstants.ShiftStandard);
                shifted.Greed.ShiftMax(-AIConstants.ShiftStandard);
            }
            else if (opponentPressure >= AIConstants.PressureElevated)
            {
                shifted.Aggression.ShiftMin(AIConstants.ShiftSmall);
            }

            // --- Hand quality shifts ---
            if (handQuality < AIConstants.HandQualityBad)
            {
                // Bad hand: lower expectations, focus on tangling instead
                shifted.Patience.Shift(-AIConstants.ShiftMedium);
                shifted.Verbosity.ShiftMax(-AIConstants.ShiftStandard);
                shifted.Greed.ShiftMax(-AIConstants.ShiftStandard);
                shifted.TrapFocus.ShiftMin(AIConstants.ShiftMedium);
                shifted.Aggression.ShiftMin(AIConstants.ShiftStandard);
            }
            else if (handQuality < AIConstants.HandQualityMediocre)
            {
                // Mediocre hand: slight tangle boost
                shifted.TrapFocus.ShiftMin(AIConstants.ShiftSmall);
            }
            else if (handQuality > AIConstants.HandQualityGreat)
            {
                // Great hand: raise expectations
                shifted.Verbosity.ShiftMin(AIConstants.ShiftStandard);
                shifted.Cleverness.ShiftMin(AIConstants.ShiftSmall);
                shifted.Greed.ShiftMin(AIConstants.ShiftSmall);
            }

            // --- Momentum shifts (scaled by sensitivity) ---
            float momEffect = SubTraits.MomentumSensitivity;
            if (momentum > AIConstants.MomentumHot)
            {
                // On a roll
                shifted.Aggression.ShiftMin(AIConstants.ShiftStandard * momEffect);
                shifted.RiskTolerance.ShiftMin(AIConstants.ShiftSmall * momEffect);
            }
            else if (momentum < AIConstants.MomentumCold)
            {
                // They're rolling
                shifted.Protectiveness.ShiftMin(AIConstants.ShiftStandard * momEffect);
                shifted.Spite.ShiftMin(AIConstants.ShiftSmall * momEffect);
            }

            // --- Endgame shifts ---
            if (boardFillPercent > AIConstants.BoardFillLateGame)
            {
                shifted.Positional.Shift(AIConstants.ShiftMedium * endgameMultiplier);
                shifted.Aggression.ShiftMin(AIConstants.ShiftStandard * endgameMultiplier);
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
            EffectiveTraits.TrapFocus = shifted.TrapFocus.Roll(_random);
            EffectiveTraits.DenialFocus = shifted.DenialFocus.Roll(_random);
            EffectiveTraits.SetupFocus = shifted.SetupFocus.Roll(_random);
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
        /// Bully: Aggressive disruptor. Focused on blocking and trapping.
        /// Pro: Tries to trap you with difficult letter placements.
        /// Con: Values scoring much lower than others.
        /// Morale: Rallies when challenged.
        /// </summary>
        public static Personality CreateBully()
        {
            return new Personality(
                "Bully",
                "Aggressive disruptor. Blocks and traps while scoring.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(8, 10),
                    Greed = new TraitRange(4, 6),
                    Protectiveness = new TraitRange(2, 4),
                    Patience = new TraitRange(1, 3),
                    Spite = new TraitRange(7, 9),
                    Positional = new TraitRange(5, 7),
                    Cleverness = new TraitRange(5, 7),
                    Verbosity = new TraitRange(2, 4),
                    Opportunism = new TraitRange(6, 8),
                    RiskTolerance = new TraitRange(6, 8),
                    TrapFocus = new TraitRange(7, 10),
                    DenialFocus = new TraitRange(5, 7),
                    SetupFocus = new TraitRange(2, 4)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.4f,
                    HandOptimism = 0.5f,
                    EndgameAwareness = 0.7f,
                    MomentumSensitivity = 0.6f,
                    MoraleDirection = 1f,
                    MoraleSensitivity = 0.7f
                }
            );
        }

        /// <summary>
        /// Scholar: Word perfectionist. Seeks longer, rarer words.
        /// Pro: Uses more rare/impressive words.
        /// Con: Avoids seeking 2-letter words (may happen incidentally).
        /// Morale: Demoralizes when outplayed.
        /// </summary>
        public static Personality CreateScholar()
        {
            return new Personality(
                "Scholar",
                "Word perfectionist. Seeks impressive long words.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(3, 5),
                    Greed = new TraitRange(5, 7),
                    Protectiveness = new TraitRange(4, 6),
                    Patience = new TraitRange(6, 8),
                    Spite = new TraitRange(2, 4),
                    Positional = new TraitRange(3, 5),
                    Cleverness = new TraitRange(4, 6),
                    Verbosity = new TraitRange(8, 10),
                    Opportunism = new TraitRange(4, 6),
                    RiskTolerance = new TraitRange(3, 5),
                    TrapFocus = new TraitRange(1, 3),
                    DenialFocus = new TraitRange(1, 3),
                    SetupFocus = new TraitRange(3, 5)
                },
                new SubTraits
                {
                    PlanningHorizon = 2,
                    Flexibility = 0.4f,
                    HandOptimism = 0.3f,
                    EndgameAwareness = 0.4f,
                    MomentumSensitivity = 0.3f,
                    MoraleDirection = -1f,
                    MoraleSensitivity = 0.4f
                }
            );
        }

        /// <summary>
        /// Builder: Creates setups for future high-scoring plays.
        /// Pro: Leaves strategic gaps, builds pillars for multi-word potential.
        /// Con: Tunnel vision on own builds, misses opponent threats.
        /// Morale: Demoralizes when builds are disrupted.
        /// </summary>
        public static Personality CreateBuilder()
        {
            return new Personality(
                "Builder",
                "Patient architect. Creates gaps and pillars for future plays.",
                new PersonalityTraitRanges
                {
                    Aggression = new TraitRange(2, 4),
                    Greed = new TraitRange(3, 5),
                    Protectiveness = new TraitRange(3, 5),
                    Patience = new TraitRange(8, 10),
                    Spite = new TraitRange(1, 3),
                    Positional = new TraitRange(8, 10),
                    Cleverness = new TraitRange(6, 8),
                    Verbosity = new TraitRange(5, 7),
                    Opportunism = new TraitRange(2, 4),
                    RiskTolerance = new TraitRange(3, 5),
                    TrapFocus = new TraitRange(2, 4),
                    DenialFocus = new TraitRange(1, 3),
                    SetupFocus = new TraitRange(8, 10)
                },
                new SubTraits
                {
                    PlanningHorizon = 2,
                    Flexibility = 0.3f,
                    HandOptimism = 0.4f,
                    EndgameAwareness = 0.5f,
                    MomentumSensitivity = 0.3f,
                    MoraleDirection = -1f,
                    MoraleSensitivity = 0.5f
                }
            );
        }

        /// <summary>
        /// Balanced: Jack of all trades. No standout strengths or weaknesses.
        /// Pro: Adapts to any situation.
        /// Con: No extreme capabilities.
        /// Morale: Stoic - unaffected by opponent's plays.
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
                    RiskTolerance = new TraitRange(4, 6),
                    TrapFocus = new TraitRange(4, 6),
                    DenialFocus = new TraitRange(3, 5),
                    SetupFocus = new TraitRange(4, 6)
                },
                new SubTraits
                {
                    PlanningHorizon = 1,
                    Flexibility = 0.5f,
                    HandOptimism = 0.5f,
                    EndgameAwareness = 0.5f,
                    MomentumSensitivity = 0.5f,
                    MoraleDirection = 0f,
                    MoraleSensitivity = 0f
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
                case "bully": return CreateBully();
                case "scholar": return CreateScholar();
                case "builder": return CreateBuilder();
                case "balanced": return CreateBalanced();
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
                "Bully", "Scholar", "Builder", "Balanced"
            };
        }
    }
}