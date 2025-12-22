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
        /// Vertical offset (in world units) for dragged objects.
        /// Moves the dragged item up on screen so it's visible above the finger.
        /// Default: 2.0 units. Range: 0 to 5.
        /// </summary>
        public static float DragOffset { get; set; } = 2.0f;

        /// <summary>
        /// Minimum drag offset value (for menu slider).
        /// </summary>
        public const float DragOffsetMin = 0f;

        /// <summary>
        /// Maximum drag offset value (for menu slider).
        /// </summary>
        public const float DragOffsetMax = 5f;
    }
}