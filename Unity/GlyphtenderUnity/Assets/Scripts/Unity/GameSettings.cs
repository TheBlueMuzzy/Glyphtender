using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Centralized game settings that can be modified at runtime.
    /// These will be exposed in the game menu.
    /// </summary>
    public static class GameSettings
    {
        /// <summary>
        /// Drag offset multiplier (0, 1, or 2).
        /// Multiplied by base offset to get actual world units.
        /// 0 = no offset, 1 = small offset, 2 = large offset.
        /// </summary>
        public static float DragOffset { get; set; } = 2f;

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