using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Shared input utilities for drag handlers.
    /// </summary>
    public static class InputUtility
    {
        /// <summary>
        /// Gets the mouse position projected onto the board plane (y=0).
        /// </summary>
        public static Vector3 GetMouseWorldPosition(Camera camera)
        {
            Ray ray = camera.ScreenPointToRay(Input.mousePosition);
            Plane boardPlane = new Plane(Vector3.up, Vector3.zero);

            if (boardPlane.Raycast(ray, out float distance))
            {
                return ray.GetPoint(distance);
            }

            return Vector3.zero;
        }
    }
}