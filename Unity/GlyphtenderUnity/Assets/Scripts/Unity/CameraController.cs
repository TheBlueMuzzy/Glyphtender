using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Controls camera positioning to ensure the board is always visible.
    /// Adapts to different screen sizes and orientations.
    /// </summary>
    public class CameraController : MonoBehaviour
    {
        [Header("Board Bounds")]
        public Vector2 boardCenter = new Vector2(7.5f, 8.5f);
        public float boardWidth = 16f;
        public float boardHeight = 18f;

        [Header("Padding")]
        public float paddingPercent = 0.1f;

        private Camera _camera;
        private float _lastAspect;
        private ScreenOrientation _lastOrientation;

        private void Start()
        {
            _camera = GetComponent<Camera>();
            AdjustCamera();
        }

        private void Update()
        {
            // Check if aspect ratio or orientation changed
            if (Mathf.Abs(_camera.aspect - _lastAspect) > 0.01f ||
                Screen.orientation != _lastOrientation)
            {
                AdjustCamera();
            }
        }

        /// <summary>
        /// Adjusts camera position and size to fit the board.
        /// </summary>
        public void AdjustCamera()
        {
            _lastAspect = _camera.aspect;
            _lastOrientation = Screen.orientation;

            // Calculate required size to fit board with padding
            float paddedWidth = boardWidth * (1f + paddingPercent);
            float paddedHeight = boardHeight * (1f + paddingPercent);

            // For orthographic camera, calculate size needed
            // Size is half the vertical extent
            float verticalSize = paddedHeight / 2f;
            float horizontalSize = paddedWidth / (2f * _camera.aspect);

            // Use the larger of the two to ensure everything fits
            float requiredSize = Mathf.Max(verticalSize, horizontalSize);

            // Set camera to orthographic and adjust size
            _camera.orthographic = true;
            _camera.orthographicSize = requiredSize;

            // Position camera above board center, looking down
            transform.position = new Vector3(boardCenter.x, 20f, boardCenter.y);
            transform.rotation = Quaternion.Euler(90f, 0f, 0f);

            Debug.Log($"Camera adjusted. Aspect: {_camera.aspect:F2}, Size: {requiredSize:F2}, Orientation: {Screen.orientation}");
        }
    }
}