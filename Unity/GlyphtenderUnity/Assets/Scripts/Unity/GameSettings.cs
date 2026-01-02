using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Centralized game settings that can be modified at runtime.
    /// Persisted via SettingsManager.
    /// </summary>
    public static class GameSettings
    {
        /// <summary>
        /// Drag offset multiplier (0, 1, or 2).
        /// Multiplied by base offset to get actual world units.
        /// 0 = no offset, 1 = small offset, 2 = large offset.
        /// </summary>
        public static float DragOffset
        {
            get
            {
                if (SettingsManager.Instance != null)
                    return SettingsManager.Instance.DragOffset;
                return _fallbackDragOffset;
            }
            set
            {
                if (SettingsManager.Instance != null)
                    SettingsManager.Instance.DragOffset = (int)value;
                else
                    _fallbackDragOffset = value;
            }
        }

        // Fallback value used before SettingsManager initializes
        private static float _fallbackDragOffset = 2f;

        /// <summary>
        /// Base offset distance in world units (multiplied by DragOffset).
        /// </summary>
        public const float DragOffsetBase = 1.5f;

        /// <summary>
        /// Gets the actual drag offset in world units.
        /// </summary>
        public static float GetDragOffsetWorld()
        {
            return DragOffset * DragOffsetBase;
        }

        /// <summary>
        /// Minimum drag offset value.
        /// </summary>
        public const float DragOffsetMin = 0f;

        /// <summary>
        /// Maximum drag offset value.
        /// </summary>
        public const float DragOffsetMax = 2f;
    }
}