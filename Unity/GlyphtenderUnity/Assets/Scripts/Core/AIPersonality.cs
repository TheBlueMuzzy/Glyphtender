using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// AI difficulty levels affecting trait consistency and vocabulary access.
    /// </summary>
    public enum AIDifficulty
    {
        Apprentice,  // Easy - wider ranges, fewer words known
        FirstClass,  // Medium - baseline
        Archmage     // Hard - tighter ranges, all words known
    }

    /// <summary>
    /// Meta-traits are fixed personality attributes (not rolled).
    /// They affect perception and vocabulary, not goal selection.
    /// </summary>
    public class MetaTraits
    {
        /// <summary>
        /// Zipf threshold modifier for vocabulary access.
        /// Negative = knows more words, Positive = knows fewer words.
        /// Stacks with difficulty threshold.
        /// </summary>
        public float VocabularyModifier { get; set; } = 0f;

        /// <summary>
        /// How well AI tracks own score (0-100).
        /// Higher = more accurate self-score perception.
        /// </summary>
        public float SelfScoreAccuracy { get; set; } = 50f;

        /// <summary>
        /// How well AI tracks opponent score (0-100).
        /// Higher = more accurate opponent-score perception.
        /// </summary>
        public float OpponentScoreAccuracy { get; set; } = 50f;

        /// <summary>
        /// How AI responds to opponent's big turns.
        /// > 50 = energized (plays better), < 50 = demoralized (plays worse).
        /// </summary>
        public float MoraleResponse { get; set; } = 50f;
    }

    /// <summary>
    /// Subtraits define how much game state shifts trait ranges.
    /// Each is a sensitivity value (0-100) controlling shift magnitude.
    /// </summary>
    public class SubTraits
    {
        /// <summary>
        /// How much BoardFill affects traits as game progresses.
        /// High = big shifts in endgame.
        /// </summary>
        public float EndgameSensitivity { get; set; } = 50f;

        /// <summary>
        /// How much perceived score deficit affects traits.
        /// High = dramatic shifts when behind.
        /// </summary>
        public float DesperationSensitivity { get; set; } = 50f;

        /// <summary>
        /// How much scoring streaks affect traits.
        /// High = confidence swings based on momentum.
        /// </summary>
        public float MomentumSensitivity { get; set; } = 50f;

        /// <summary>
        /// How much own glyphling danger affects Caution.
        /// High = reactive to threats.
        /// </summary>
        public float PressureSensitivity { get; set; } = 50f;

        /// <summary>
        /// How much opponent vulnerability affects Aggression/Opportunism.
        /// High = pounces on weakness.
        /// </summary>
        public float OpportunitySensitivity { get; set; } = 50f;

        /// <summary>
        /// How much hand quality affects Pragmatism/Greed.
        /// High = hand composition matters more.
        /// </summary>
        public float HandQualitySensitivity { get; set; } = 50f;
    }

    /// <summary>
    /// Per-trait shift configuration for subtraits.
    /// Defines which direction each trait shifts under each condition.
    /// </summary>
    public class TraitShiftConfig
    {
        // Endgame shifts (applied as BoardFill increases)
        public float AggressionEndgame { get; set; } = 0f;
        public float GreedEndgame { get; set; } = 0f;
        public float SpiteEndgame { get; set; } = 0f;
        public float CautionEndgame { get; set; } = 0f;
        public float PatienceEndgame { get; set; } = 0f;
        public float OpportunismEndgame { get; set; } = 0f;
        public float PragmatismEndgame { get; set; } = 0f;

        // Desperation shifts (applied when behind in score)
        public float AggressionDesperation { get; set; } = 0f;
        public float GreedDesperation { get; set; } = 0f;
        public float CautionDesperation { get; set; } = 0f;
        public float PragmatismDesperation { get; set; } = 0f;
    }

    /// <summary>
    /// A complete AI personality definition.
    ///
    /// Contains:
    /// - Base trait ranges (7 traits, 0-100 scale)
    /// - Goal priority order
    /// - Meta-traits (vocabulary, score perception, morale)
    /// - Subtraits (situational shift sensitivities)
    /// </summary>
    public class AIPersonality
    {
        public string Name { get; private set; }
        public string Description { get; private set; }

        /// <summary>
        /// Base trait ranges before any situational shifts.
        /// Key = AITrait enum, Value = TraitRange (0-100 scale)
        /// </summary>
        public Dictionary<AITrait, TraitRange> BaseTraitRanges { get; private set; }

        /// <summary>
        /// Goal priority order (first = primary goal, used as fallback).
        /// </summary>
        public AIGoal[] GoalPriority { get; private set; }

        /// <summary>
        /// Meta-traits affecting perception and vocabulary.
        /// </summary>
        public MetaTraits MetaTraits { get; private set; }

        /// <summary>
        /// Subtraits controlling situational shift magnitudes.
        /// </summary>
        public SubTraits SubTraits { get; private set; }

        /// <summary>
        /// Per-trait shift directions for various conditions.
        /// </summary>
        public TraitShiftConfig ShiftConfig { get; private set; }

        private Random _random;

        public AIPersonality(
            string name,
            string description,
            Dictionary<AITrait, TraitRange> baseRanges,
            AIGoal[] goalPriority,
            MetaTraits metaTraits = null,
            SubTraits subTraits = null,
            TraitShiftConfig shiftConfig = null,
            int? seed = null)
        {
            Name = name;
            Description = description;
            BaseTraitRanges = baseRanges;
            GoalPriority = goalPriority;
            MetaTraits = metaTraits ?? new MetaTraits();
            SubTraits = subTraits ?? new SubTraits();
            ShiftConfig = shiftConfig ?? new TraitShiftConfig();
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
        }

        /// <summary>
        /// Gets current trait ranges after applying all situational shifts.
        /// Call this at the start of each AI turn.
        /// </summary>
        public Dictionary<AITrait, TraitRange> GetShiftedRanges(
            AIDifficulty difficulty,
            float boardFillPercent,
            float perceivedLead,
            float myPressure,
            float opponentPressure,
            float handQuality,
            float momentum,
            int lastOpponentScore)
        {
            // Start with clones of base ranges
            var shifted = new Dictionary<AITrait, TraitRange>();
            foreach (var kvp in BaseTraitRanges)
            {
                shifted[kvp.Key] = kvp.Value.Clone();
            }

            // Apply difficulty scaling
            ApplyDifficultyScaling(shifted, difficulty);

            // Apply morale effect from opponent's last turn
            ApplyMoraleEffect(shifted, lastOpponentScore);

            // Apply endgame shifts
            ApplyEndgameShifts(shifted, boardFillPercent);

            // Apply desperation shifts (when behind)
            ApplyDesperationShifts(shifted, perceivedLead);

            // Apply pressure response (own glyphling in danger)
            ApplyPressureResponse(shifted, myPressure);

            // Apply opportunity response (opponent vulnerable)
            ApplyOpportunityResponse(shifted, opponentPressure);

            // Apply hand quality shifts
            ApplyHandQualityShifts(shifted, handQuality);

            // Apply momentum shifts
            ApplyMomentumShifts(shifted, momentum);

            return shifted;
        }

        /// <summary>
        /// Gets the effective Zipf threshold for vocabulary access.
        /// </summary>
        public float GetZipfThreshold(AIDifficulty difficulty)
        {
            float baseThreshold;
            switch (difficulty)
            {
                case AIDifficulty.Apprentice:
                    baseThreshold = 3.0f;
                    break;
                case AIDifficulty.FirstClass:
                    baseThreshold = 2.0f;
                    break;
                case AIDifficulty.Archmage:
                    baseThreshold = 0.0f;
                    break;
                default:
                    baseThreshold = 2.0f;
                    break;
            }

            // Apply personality modifier (negative = knows more words)
            return Math.Max(0f, baseThreshold + MetaTraits.VocabularyModifier);
        }

        private void ApplyDifficultyScaling(Dictionary<AITrait, TraitRange> ranges, AIDifficulty difficulty)
        {
            foreach (var range in ranges.Values)
            {
                switch (difficulty)
                {
                    case AIDifficulty.Apprentice:
                        // Widen ranges (more variance) and shift down slightly
                        range.Widen(0.3f);
                        range.Shift(-10f);
                        break;
                    case AIDifficulty.FirstClass:
                        // No change
                        break;
                    case AIDifficulty.Archmage:
                        // Narrow ranges (more consistent) and shift up
                        range.Narrow(0.3f);
                        range.Shift(10f);
                        break;
                }
            }
        }

        private void ApplyMoraleEffect(Dictionary<AITrait, TraitRange> ranges, int lastOpponentScore)
        {
            if (lastOpponentScore < 10) return; // No morale effect for small scores

            float moraleStrength = (lastOpponentScore - 10) / 10f; // 0-1 scale for 10-20 pts
            moraleStrength = Math.Min(1f, moraleStrength);

            // MoraleResponse > 50 = energized, < 50 = demoralized
            float moraleDirection = (MetaTraits.MoraleResponse - 50f) / 50f; // -1 to +1
            float shift = moraleStrength * moraleDirection * 15f; // up to +/-15 shift

            // Apply to all traits
            foreach (var range in ranges.Values)
            {
                range.Shift(shift);
            }
        }

        private void ApplyEndgameShifts(Dictionary<AITrait, TraitRange> ranges, float boardFillPercent)
        {
            if (boardFillPercent < 0.4f) return; // No endgame effect early

            // Scale from 0 at 40% to 1 at 80%
            float endgameIntensity = (boardFillPercent - 0.4f) / 0.4f;
            endgameIntensity = Math.Min(1f, endgameIntensity);

            float sensitivity = SubTraits.EndgameSensitivity / 100f;
            float multiplier = endgameIntensity * sensitivity;

            ApplyShift(ranges, AITrait.Aggression, ShiftConfig.AggressionEndgame * multiplier);
            ApplyShift(ranges, AITrait.Greed, ShiftConfig.GreedEndgame * multiplier);
            ApplyShift(ranges, AITrait.Spite, ShiftConfig.SpiteEndgame * multiplier);
            ApplyShift(ranges, AITrait.Caution, ShiftConfig.CautionEndgame * multiplier);
            ApplyShift(ranges, AITrait.Patience, ShiftConfig.PatienceEndgame * multiplier);
            ApplyShift(ranges, AITrait.Opportunism, ShiftConfig.OpportunismEndgame * multiplier);
            ApplyShift(ranges, AITrait.Pragmatism, ShiftConfig.PragmatismEndgame * multiplier);
        }

        private void ApplyDesperationShifts(Dictionary<AITrait, TraitRange> ranges, float perceivedLead)
        {
            if (perceivedLead >= -5f) return; // Not desperate yet

            // Scale from 0 at -5 to 1 at -25
            float desperationIntensity = (-perceivedLead - 5f) / 20f;
            desperationIntensity = Math.Min(1f, desperationIntensity);

            float sensitivity = SubTraits.DesperationSensitivity / 100f;
            float multiplier = desperationIntensity * sensitivity;

            ApplyShift(ranges, AITrait.Aggression, ShiftConfig.AggressionDesperation * multiplier);
            ApplyShift(ranges, AITrait.Greed, ShiftConfig.GreedDesperation * multiplier);
            ApplyShift(ranges, AITrait.Caution, ShiftConfig.CautionDesperation * multiplier);
            ApplyShift(ranges, AITrait.Pragmatism, ShiftConfig.PragmatismDesperation * multiplier);
        }

        private void ApplyPressureResponse(Dictionary<AITrait, TraitRange> ranges, float myPressure)
        {
            if (myPressure < 5f) return; // Not in danger

            // Scale from 0 at pressure 5 to 1 at pressure 10
            float dangerIntensity = (myPressure - 5f) / 5f;
            dangerIntensity = Math.Min(1f, dangerIntensity);

            float sensitivity = SubTraits.PressureSensitivity / 100f;
            float shift = dangerIntensity * sensitivity * 20f; // up to +20 to Caution

            ApplyShift(ranges, AITrait.Caution, shift);
            ApplyShift(ranges, AITrait.Aggression, -shift * 0.5f); // Reduce aggression when in danger
        }

        private void ApplyOpportunityResponse(Dictionary<AITrait, TraitRange> ranges, float opponentPressure)
        {
            if (opponentPressure < 5f) return; // Opponent not vulnerable

            // Scale from 0 at pressure 5 to 1 at pressure 10
            float opportunityIntensity = (opponentPressure - 5f) / 5f;
            opportunityIntensity = Math.Min(1f, opportunityIntensity);

            float sensitivity = SubTraits.OpportunitySensitivity / 100f;
            float shift = opportunityIntensity * sensitivity * 20f;

            ApplyShift(ranges, AITrait.Aggression, shift);
            ApplyShift(ranges, AITrait.Opportunism, shift);
        }

        private void ApplyHandQualityShifts(Dictionary<AITrait, TraitRange> ranges, float handQuality)
        {
            float sensitivity = SubTraits.HandQualitySensitivity / 100f;

            if (handQuality < 4f)
            {
                // Bad hand - boost Pragmatism (dump junk), reduce Greed (lower expectations)
                float badHandIntensity = (4f - handQuality) / 4f;
                float shift = badHandIntensity * sensitivity * 15f;

                ApplyShift(ranges, AITrait.Pragmatism, shift);
                ApplyShift(ranges, AITrait.Greed, -shift);
            }
            else if (handQuality > 7f)
            {
                // Great hand - boost Greed, reduce Pragmatism
                float greatHandIntensity = (handQuality - 7f) / 3f;
                float shift = greatHandIntensity * sensitivity * 10f;

                ApplyShift(ranges, AITrait.Greed, shift);
                ApplyShift(ranges, AITrait.Pragmatism, -shift);
            }
        }

        private void ApplyMomentumShifts(Dictionary<AITrait, TraitRange> ranges, float momentum)
        {
            float sensitivity = SubTraits.MomentumSensitivity / 100f;

            if (momentum > 2f)
            {
                // On a roll - boost Aggression slightly
                float hotIntensity = (momentum - 2f) / 3f;
                float shift = hotIntensity * sensitivity * 10f;

                ApplyShift(ranges, AITrait.Aggression, shift);
            }
            else if (momentum < -2f)
            {
                // Cold streak - boost Caution slightly
                float coldIntensity = (-momentum - 2f) / 3f;
                float shift = coldIntensity * sensitivity * 10f;

                ApplyShift(ranges, AITrait.Caution, shift);
            }
        }

        private void ApplyShift(Dictionary<AITrait, TraitRange> ranges, AITrait trait, float amount)
        {
            if (ranges.TryGetValue(trait, out TraitRange range))
            {
                range.Shift(amount);
            }
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
    /// </summary>
    public static class AIPersonalityPresets
    {
        /// <summary>
        /// Bully: Aggressive hunter. Prioritizes trapping over scoring.
        /// "I want to watch you squirm."
        /// </summary>
        public static AIPersonality CreateBully()
        {
            return new AIPersonality(
                "Bully",
                "Aggressive hunter. Prioritizes trapping over scoring.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Aggression, new TraitRange(80, 95) },
                    { AITrait.Spite, new TraitRange(60, 80) },
                    { AITrait.Opportunism, new TraitRange(40, 60) },
                    { AITrait.Greed, new TraitRange(30, 50) },
                    { AITrait.Caution, new TraitRange(20, 40) },
                    { AITrait.Patience, new TraitRange(10, 30) },
                    { AITrait.Pragmatism, new TraitRange(20, 40) }
                },
                new AIGoal[] { AIGoal.Trap, AIGoal.Deny, AIGoal.Steal, AIGoal.Score, AIGoal.Escape, AIGoal.Build, AIGoal.Dump },
                new MetaTraits
                {
                    VocabularyModifier = 0.5f,  // Knows fewer words
                    SelfScoreAccuracy = 40f,    // Doesn't count points well
                    OpponentScoreAccuracy = 70f, // Watches opponent closely
                    MoraleResponse = 70f         // Gets energized by challenge
                },
                new SubTraits
                {
                    EndgameSensitivity = 80f,
                    DesperationSensitivity = 60f,
                    MomentumSensitivity = 60f,
                    PressureSensitivity = 40f,   // Ignores own danger somewhat
                    OpportunitySensitivity = 80f, // Pounces on weakness
                    HandQualitySensitivity = 30f  // Doesn't care much about hand
                },
                new TraitShiftConfig
                {
                    AggressionEndgame = 20f,    // Gets more aggressive late game
                    CautionEndgame = -10f,      // Less cautious
                    AggressionDesperation = 15f // Desperate = more aggressive
                }
            );
        }

        /// <summary>
        /// Scholar: Word perfectionist. Seeks high-scoring words.
        /// "Did you know 'QUIXOTIC' is worth..."
        /// </summary>
        public static AIPersonality CreateScholar()
        {
            return new AIPersonality(
                "Scholar",
                "Word perfectionist. Seeks impressive long words.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Greed, new TraitRange(85, 100) },
                    { AITrait.Patience, new TraitRange(60, 80) },
                    { AITrait.Spite, new TraitRange(30, 50) },
                    { AITrait.Pragmatism, new TraitRange(50, 70) },
                    { AITrait.Caution, new TraitRange(40, 60) },
                    { AITrait.Opportunism, new TraitRange(20, 40) },
                    { AITrait.Aggression, new TraitRange(10, 25) }
                },
                new AIGoal[] { AIGoal.Score, AIGoal.Build, AIGoal.Deny, AIGoal.Dump, AIGoal.Escape, AIGoal.Steal, AIGoal.Trap },
                new MetaTraits
                {
                    VocabularyModifier = -1.0f, // Knows many more words
                    SelfScoreAccuracy = 80f,    // Tracks own score well
                    OpponentScoreAccuracy = 50f,
                    MoraleResponse = 30f        // Gets demoralized when outplayed
                },
                new SubTraits
                {
                    EndgameSensitivity = 40f,
                    DesperationSensitivity = 70f, // Panics when behind
                    MomentumSensitivity = 30f,
                    PressureSensitivity = 50f,
                    OpportunitySensitivity = 30f,
                    HandQualitySensitivity = 80f  // Very sensitive to hand quality
                },
                new TraitShiftConfig
                {
                    GreedDesperation = -20f,    // Lowers expectations when behind
                    PragmatismDesperation = 15f  // Dumps more when desperate
                }
            );
        }

        /// <summary>
        /// Builder: Patient architect. Creates setups for future plays.
        /// "Just setting up for next turn..."
        /// </summary>
        public static AIPersonality CreateBuilder()
        {
            return new AIPersonality(
                "Builder",
                "Patient architect. Creates gaps and pillars for future plays.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Patience, new TraitRange(85, 100) },
                    { AITrait.Caution, new TraitRange(50, 70) },
                    { AITrait.Greed, new TraitRange(40, 60) },
                    { AITrait.Pragmatism, new TraitRange(40, 60) },
                    { AITrait.Spite, new TraitRange(20, 40) },
                    { AITrait.Opportunism, new TraitRange(15, 35) },
                    { AITrait.Aggression, new TraitRange(10, 25) }
                },
                new AIGoal[] { AIGoal.Build, AIGoal.Score, AIGoal.Escape, AIGoal.Deny, AIGoal.Dump, AIGoal.Steal, AIGoal.Trap },
                new MetaTraits
                {
                    VocabularyModifier = 0f,
                    SelfScoreAccuracy = 60f,
                    OpponentScoreAccuracy = 40f,
                    MoraleResponse = 40f  // Slightly demoralized by disruption
                },
                new SubTraits
                {
                    EndgameSensitivity = 70f,   // Shifts behavior late game
                    DesperationSensitivity = 50f,
                    MomentumSensitivity = 30f,
                    PressureSensitivity = 60f,
                    OpportunitySensitivity = 40f,
                    HandQualitySensitivity = 50f
                },
                new TraitShiftConfig
                {
                    PatienceEndgame = -30f,    // Stops building late game
                    GreedEndgame = 25f         // Cashes in on setups
                }
            );
        }

        /// <summary>
        /// Vulture: Opportunistic thief. Steals opponent's setups.
        /// "That was going to be YOUR word."
        /// </summary>
        public static AIPersonality CreateVulture()
        {
            return new AIPersonality(
                "Vulture",
                "Opportunistic thief. Steals opponent's setups.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Opportunism, new TraitRange(80, 95) },
                    { AITrait.Spite, new TraitRange(70, 85) },
                    { AITrait.Greed, new TraitRange(50, 70) },
                    { AITrait.Patience, new TraitRange(40, 60) },
                    { AITrait.Caution, new TraitRange(30, 50) },
                    { AITrait.Pragmatism, new TraitRange(30, 50) },
                    { AITrait.Aggression, new TraitRange(20, 40) }
                },
                new AIGoal[] { AIGoal.Steal, AIGoal.Deny, AIGoal.Score, AIGoal.Build, AIGoal.Escape, AIGoal.Dump, AIGoal.Trap },
                new MetaTraits
                {
                    VocabularyModifier = 0.2f,
                    SelfScoreAccuracy = 50f,
                    OpponentScoreAccuracy = 70f, // Watches what opponent is building
                    MoraleResponse = 60f
                },
                new SubTraits
                {
                    EndgameSensitivity = 50f,
                    DesperationSensitivity = 50f,
                    MomentumSensitivity = 60f,  // Reacts to opponent's success
                    PressureSensitivity = 50f,
                    OpportunitySensitivity = 90f, // Extremely opportunistic
                    HandQualitySensitivity = 40f
                },
                new TraitShiftConfig
                {
                    SpiteEndgame = 15f  // More spiteful late game
                }
            );
        }

        /// <summary>
        /// Survivor: Defensive player. Prioritizes safety.
        /// "You won't catch me."
        /// </summary>
        public static AIPersonality CreateSurvivor()
        {
            return new AIPersonality(
                "Survivor",
                "Defensive player. Prioritizes safety over scoring.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Caution, new TraitRange(85, 100) },
                    { AITrait.Patience, new TraitRange(60, 80) },
                    { AITrait.Greed, new TraitRange(40, 60) },
                    { AITrait.Pragmatism, new TraitRange(40, 60) },
                    { AITrait.Spite, new TraitRange(20, 40) },
                    { AITrait.Opportunism, new TraitRange(20, 40) },
                    { AITrait.Aggression, new TraitRange(5, 20) }
                },
                new AIGoal[] { AIGoal.Escape, AIGoal.Build, AIGoal.Score, AIGoal.Deny, AIGoal.Dump, AIGoal.Steal, AIGoal.Trap },
                new MetaTraits
                {
                    VocabularyModifier = 0.3f,
                    SelfScoreAccuracy = 70f,
                    OpponentScoreAccuracy = 30f, // Focused inward
                    MoraleResponse = 30f         // Panics under pressure
                },
                new SubTraits
                {
                    EndgameSensitivity = 70f,
                    DesperationSensitivity = 80f,
                    MomentumSensitivity = 40f,
                    PressureSensitivity = 90f,   // Extremely reactive to danger
                    OpportunitySensitivity = 30f,
                    HandQualitySensitivity = 50f
                },
                new TraitShiftConfig
                {
                    CautionEndgame = 20f,       // Even more careful late game
                    AggressionDesperation = 25f // Only aggressive when losing badly
                }
            );
        }

        /// <summary>
        /// Balanced: Jack of all trades. Adapts without extremes.
        /// "Whatever works."
        /// </summary>
        public static AIPersonality CreateBalanced()
        {
            return new AIPersonality(
                "Balanced",
                "Well-rounded generalist. Adapts without extremes.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Greed, new TraitRange(50, 70) },
                    { AITrait.Caution, new TraitRange(50, 70) },
                    { AITrait.Spite, new TraitRange(40, 60) },
                    { AITrait.Patience, new TraitRange(40, 60) },
                    { AITrait.Pragmatism, new TraitRange(40, 60) },
                    { AITrait.Opportunism, new TraitRange(40, 60) },
                    { AITrait.Aggression, new TraitRange(40, 60) }
                },
                new AIGoal[] { AIGoal.Score, AIGoal.Escape, AIGoal.Deny, AIGoal.Build, AIGoal.Steal, AIGoal.Dump, AIGoal.Trap },
                new MetaTraits
                {
                    VocabularyModifier = 0f,
                    SelfScoreAccuracy = 50f,
                    OpponentScoreAccuracy = 50f,
                    MoraleResponse = 50f  // Stoic
                },
                new SubTraits
                {
                    EndgameSensitivity = 50f,
                    DesperationSensitivity = 50f,
                    MomentumSensitivity = 50f,
                    PressureSensitivity = 50f,
                    OpportunitySensitivity = 50f,
                    HandQualitySensitivity = 50f
                },
                new TraitShiftConfig() // No special shifts
            );
        }

        /// <summary>
        /// Strategist: Multi-word specialist. Seeks intersection plays.
        /// "Two words, one move."
        /// </summary>
        public static AIPersonality CreateStrategist()
        {
            return new AIPersonality(
                "Strategist",
                "Multi-word specialist. Seeks intersection plays.",
                new Dictionary<AITrait, TraitRange>
                {
                    { AITrait.Greed, new TraitRange(70, 85) },
                    { AITrait.Patience, new TraitRange(65, 80) },
                    { AITrait.Spite, new TraitRange(50, 70) },
                    { AITrait.Caution, new TraitRange(45, 65) },
                    { AITrait.Opportunism, new TraitRange(40, 60) },
                    { AITrait.Pragmatism, new TraitRange(35, 55) },
                    { AITrait.Aggression, new TraitRange(25, 45) }
                },
                new AIGoal[] { AIGoal.Score, AIGoal.Build, AIGoal.Deny, AIGoal.Escape, AIGoal.Steal, AIGoal.Dump, AIGoal.Trap },
                new MetaTraits
                {
                    VocabularyModifier = -0.5f, // Knows more words
                    SelfScoreAccuracy = 70f,
                    OpponentScoreAccuracy = 60f,
                    MoraleResponse = 55f  // Slightly energized by challenge
                },
                new SubTraits
                {
                    EndgameSensitivity = 60f,
                    DesperationSensitivity = 50f,
                    MomentumSensitivity = 40f,
                    PressureSensitivity = 55f,
                    OpportunitySensitivity = 50f,
                    HandQualitySensitivity = 60f
                },
                new TraitShiftConfig
                {
                    GreedEndgame = 15f,
                    PatienceEndgame = -20f
                }
            );
        }

        /// <summary>
        /// Gets a personality by name (case-insensitive).
        /// Returns Balanced if name not found.
        /// </summary>
        public static AIPersonality GetByName(string name)
        {
            switch (name?.ToLower())
            {
                case "bully": return CreateBully();
                case "scholar": return CreateScholar();
                case "builder": return CreateBuilder();
                case "vulture": return CreateVulture();
                case "survivor": return CreateSurvivor();
                case "strategist": return CreateStrategist();
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
                "Bully", "Scholar", "Builder", "Vulture", "Survivor", "Strategist", "Balanced"
            };
        }
    }
}
