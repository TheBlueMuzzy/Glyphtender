using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Static utility for converting between hex coordinates and world positions.
    /// Extracted from BoardRenderer to allow reuse without rendering dependencies.
    /// 
    /// Uses flat-top hex layout with offset columns.
    /// </summary>
    public static class HexCoordConverter
    {
        /// <summary>
        /// Default spacing between hex centers.
        /// BoardRenderer can override this via the instance methods if needed.
        /// </summary>
        public const float DefaultHexSpacing = 1f;

        /// <summary>
        /// Converts hex coordinates to world position.
        /// </summary>
        /// <param name="hex">The hex coordinate</param>
        /// <param name="hexSpacing">Distance between hex centers (default 1.0)</param>
        /// <returns>World position (y = 0)</returns>
        public static Vector3 HexToWorld(HexCoord hex, float hexSpacing = DefaultHexSpacing)
        {
            // Flat-top hex layout with independent columns
            float x = hexSpacing * 1.5f * hex.Column;

            // Offset odd columns by half a hex height
            float zOffset = (hex.Column % 2 == 1) ? hexSpacing * Mathf.Sqrt(3f) / 2f : 0f;
            float z = hexSpacing * Mathf.Sqrt(3f) * hex.Row + zOffset;

            return new Vector3(x, 0f, z);
        }

        /// <summary>
        /// Converts world position to nearest hex coordinate.
        /// Caller should validate result against actual board bounds.
        /// </summary>
        /// <param name="worldPos">World position</param>
        /// <param name="hexSpacing">Distance between hex centers (default 1.0)</param>
        /// <returns>Nearest hex coordinate</returns>
        public static HexCoord WorldToHex(Vector3 worldPos, float hexSpacing = DefaultHexSpacing)
        {
            // Reverse of HexToWorld
            // x = hexSpacing * 1.5f * column
            // z = hexSpacing * sqrt(3) * row + offset

            // Estimate column from x
            float colFloat = worldPos.x / (hexSpacing * 1.5f);
            int col = Mathf.RoundToInt(colFloat);

            // Calculate z offset for this column
            float zOffset = (col % 2 == 1) ? hexSpacing * Mathf.Sqrt(3f) / 2f : 0f;

            // Calculate row from z
            float rowFloat = (worldPos.z - zOffset) / (hexSpacing * Mathf.Sqrt(3f));
            int row = Mathf.RoundToInt(rowFloat);

            return new HexCoord(col, row);
        }

        /// <summary>
        /// Gets the world-space width of a flat-top hex.
        /// </summary>
        public static float GetHexWidth(float hexSpacing = DefaultHexSpacing)
        {
            return hexSpacing * 2f;
        }

        /// <summary>
        /// Gets the world-space height of a flat-top hex.
        /// </summary>
        public static float GetHexHeight(float hexSpacing = DefaultHexSpacing)
        {
            return hexSpacing * Mathf.Sqrt(3f);
        }
    }
}