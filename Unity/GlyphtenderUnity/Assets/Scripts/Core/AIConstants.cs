namespace Glyphtender.Core
{
    /// <summary>
    /// Constants for AI behavior tuning.
    /// Centralizes magic numbers from Personality and AIPerception systems.
    /// </summary>
    public static class AIConstants
    {
        #region Trait Bounds

        /// <summary>Minimum value for any trait (1-10 scale).</summary>
        public const float TraitMin = 1f;

        /// <summary>Maximum value for any trait (1-10 scale).</summary>
        public const float TraitMax = 10f;

        /// <summary>Default trait range minimum for balanced personality.</summary>
        public const float DefaultTraitRangeMin = 4f;

        /// <summary>Default trait range maximum for balanced personality.</summary>
        public const float DefaultTraitRangeMax = 6f;

        #endregion

        #region Difficulty Scaling

        /// <summary>Range multiplier for Apprentice difficulty (wider = more variance).</summary>
        public const float ApprenticeRangeMultiplier = 1.5f;

        /// <summary>Center shift for Apprentice difficulty (negative = weaker).</summary>
        public const float ApprenticeCenterShift = -2f;

        /// <summary>Range multiplier for Archmage difficulty (tighter = more consistent).</summary>
        public const float ArchmageRangeMultiplier = 0.5f;

        /// <summary>Center shift for Archmage difficulty (positive = stronger).</summary>
        public const float ArchmageCenterShift = 2f;

        #endregion

        #region Morale Thresholds

        /// <summary>Opponent score threshold for amplified morale effect (×1.5).</summary>
        public const int MoraleScoreAmplified = 17;

        /// <summary>Opponent score threshold for full morale effect (×1.0).</summary>
        public const int MoraleScoreFull = 12;

        /// <summary>Opponent score threshold for minor morale effect (×0.5).</summary>
        public const int MoraleScoreMinor = 8;

        /// <summary>Morale multiplier for amplified effect.</summary>
        public const float MoraleMultiplierAmplified = 1.5f;

        /// <summary>Morale multiplier for full effect.</summary>
        public const float MoraleMultiplierFull = 1.0f;

        /// <summary>Morale multiplier for minor effect.</summary>
        public const float MoraleMultiplierMinor = 0.5f;

        #endregion

        #region Situational Thresholds - Score Lead

        /// <summary>Score lead threshold for "way behind" desperation mode.</summary>
        public const float LeadWayBehind = -20f;

        /// <summary>Score lead threshold for "behind" pressure.</summary>
        public const float LeadBehind = -10f;

        /// <summary>Score lead threshold for "ahead" comfort.</summary>
        public const float LeadAhead = 10f;

        /// <summary>Score lead threshold for "way ahead" dominance.</summary>
        public const float LeadWayAhead = 20f;

        #endregion

        #region Situational Thresholds - Glyphling Pressure

        /// <summary>Pressure threshold for critical danger (survival mode).</summary>
        public const float PressureCritical = 7f;

        /// <summary>Pressure threshold for elevated concern.</summary>
        public const float PressureElevated = 5f;

        #endregion

        #region Situational Thresholds - Hand Quality

        /// <summary>Hand quality threshold for "bad hand".</summary>
        public const float HandQualityBad = 3f;

        /// <summary>Hand quality threshold for "mediocre hand".</summary>
        public const float HandQualityMediocre = 5f;

        /// <summary>Hand quality threshold for "great hand".</summary>
        public const float HandQualityGreat = 7f;

        #endregion

        #region Situational Thresholds - Board State

        /// <summary>Board fill percentage where endgame awareness begins.</summary>
        public const float BoardFillEndgameStart = 0.4f;

        /// <summary>Board fill percentage for late endgame shifts.</summary>
        public const float BoardFillLateGame = 0.6f;

        /// <summary>Board fill percentage considered full endgame.</summary>
        public const float BoardFillEndgame = 0.8f;

        #endregion

        #region Situational Thresholds - Momentum

        /// <summary>Momentum threshold for "on a roll" (positive).</summary>
        public const float MomentumHot = 2f;

        /// <summary>Momentum threshold for "opponent rolling" (negative).</summary>
        public const float MomentumCold = -2f;

        #endregion

        #region Trait Shift Amounts

        /// <summary>Large trait shift amount.</summary>
        public const float ShiftLarge = 2f;

        /// <summary>Medium trait shift amount.</summary>
        public const float ShiftMedium = 1.5f;

        /// <summary>Standard trait shift amount.</summary>
        public const float ShiftStandard = 1f;

        /// <summary>Small trait shift amount.</summary>
        public const float ShiftSmall = 0.5f;

        #endregion

        #region Perception - Score Tracking

        /// <summary>Number of recent turns to track for momentum.</summary>
        public const int MomentumWindow = 5;

        /// <summary>Confidence decay per turn.</summary>
        public const float ConfidenceDecay = 0.05f;

        /// <summary>Maximum random drift range for score estimates.</summary>
        public const float ScoreDriftRange = 3f;

        /// <summary>Confidence boost when AI scores.</summary>
        public const float ConfidenceBoostOnScore = 0.1f;

        /// <summary>Confidence boost when observing opponent score.</summary>
        public const float ConfidenceBoostOnObserve = 0.08f;

        /// <summary>Minimum confidence level.</summary>
        public const float ConfidenceMin = 0.1f;

        /// <summary>Maximum confidence level.</summary>
        public const float ConfidenceMax = 1f;

        /// <summary>Noise range multiplier for perceived lead calculation.</summary>
        public const float PerceivedLeadNoiseMultiplier = 20f;

        /// <summary>Momentum calculation divisor.</summary>
        public const float MomentumDivisor = 10f;

        /// <summary>Momentum maximum value.</summary>
        public const float MomentumMax = 5f;

        #endregion

        #region Hand Quality Assessment

        /// <summary>Baseline hand quality score.</summary>
        public const float HandQualityBaseline = 5f;

        /// <summary>Minimum vowels for a playable hand.</summary>
        public const int VowelMinimum = 2;

        /// <summary>Maximum vowels before penalty.</summary>
        public const int VowelMaximum = 4;

        /// <summary>Minimum consonants for a playable hand.</summary>
        public const int ConsonantMinimum = 3;

        /// <summary>Penalty for too few vowels.</summary>
        public const float TooFewVowelsPenalty = 1.5f;

        /// <summary>Penalty for too many vowels.</summary>
        public const float TooManyVowelsPenalty = 1f;

        /// <summary>Penalty for too few consonants.</summary>
        public const float TooFewConsonantsPenalty = 1.5f;

        /// <summary>Bonus per common letter.</summary>
        public const float CommonLetterBonus = 0.25f;

        /// <summary>Penalty for triple+ duplicate letters.</summary>
        public const float TripleDuplicatePenalty = 1f;

        /// <summary>Penalty for double duplicate letters.</summary>
        public const float DoubleDuplicatePenalty = 0.3f;

        /// <summary>Penalty per hard letter (Q, X, Z, J, V).</summary>
        public const float HardLetterPenalty = 0.4f;

        /// <summary>Bonus per word starter letter.</summary>
        public const float WordStarterBonus = 0.15f;

        /// <summary>Bonus per word ender letter.</summary>
        public const float WordEnderBonus = 0.15f;

        #endregion

        #region Glyphling Pressure Assessment

        /// <summary>Pressure added per blocked direction.</summary>
        public const float PressurePerBlockedDirection = 1.5f;

        /// <summary>Pressure penalty when only 1 escape route.</summary>
        public const float PressureSingleEscapePenalty = 2f;

        /// <summary>Pressure penalty when only 2 escape routes.</summary>
        public const float PressureDoubleEscapePenalty = 1f;

        /// <summary>Pressure from adjacent opponent glyphling.</summary>
        public const float PressureAdjacentOpponent = 1.5f;

        /// <summary>Pressure from opponent glyphling 2 hexes away.</summary>
        public const float PressureNearbyOpponent = 0.5f;

        /// <summary>Number of hex directions.</summary>
        public const int HexDirections = 6;

        #endregion

        #region Junk Letter Assessment

        /// <summary>Junk score for hard letters (Q, X, Z, J, V).</summary>
        public const float JunkHardLetterBase = 3f;

        /// <summary>Extra junk for Q without U.</summary>
        public const float JunkQWithoutU = 4f;

        /// <summary>Junk for triple+ duplicates.</summary>
        public const float JunkTripleDuplicate = 3f;

        /// <summary>Junk for double duplicates.</summary>
        public const float JunkDoubleDuplicate = 1f;

        /// <summary>Junk for excess vowels (5+).</summary>
        public const float JunkExcessVowel = 2f;

        /// <summary>Junk for consonants when vowel-starved (1 vowel).</summary>
        public const float JunkVowelStarvedConsonant = 1.5f;

        /// <summary>Junk for consonants when no vowels.</summary>
        public const float JunkNoVowelConsonant = 3f;

        /// <summary>Vowel count threshold for excess vowels.</summary>
        public const int VowelExcessThreshold = 5;

        /// <summary>Vowel count threshold for vowel-starved hand.</summary>
        public const int VowelStarvedThreshold = 1;

        #endregion
    }
}