using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Highlights words on the board with pill-shaped outlines.
    /// Creates outlines that stretch from edge to edge of word tiles.
    /// </summary>
    public class WordHighlighter : MonoBehaviour
    {
        [Header("Outline Settings")]
        public Color outlineColor = new Color(1f, 0.4f, 0.7f, 0.8f);  // Pink
        public float outlineWidth = 1.5f;
        public float outlineHeight = 1f;  // Height above board

        // Active outline objects
        private List<GameObject> _activeOutlines = new List<GameObject>();

        // Generated pill texture
        private Texture2D _pillTexture;
        private Material _outlineMaterial;

        private void Start()
        {
            CreatePillTexture();
            CreateOutlineMaterial();

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged += RefreshHighlights;
                GameManager.Instance.OnGameStateChanged += ClearHighlights;
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged -= RefreshHighlights;
                GameManager.Instance.OnGameStateChanged -= ClearHighlights;
            }

            if (_pillTexture != null)
            {
                Destroy(_pillTexture);
            }
            if (_outlineMaterial != null)
            {
                Destroy(_outlineMaterial);
            }
        }

        /// <summary>
        /// Creates a pill-shaped texture procedurally with true semicircle caps.
        /// </summary>
        private void CreatePillTexture()
        {
            // Make texture square-ish so caps are true semicircles
            int height = 64;
            int width = height * 2;  // Width is 2x height so each cap is a full semicircle
            int borderThickness = 5;

            _pillTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            _pillTexture.filterMode = FilterMode.Bilinear;

            Color transparent = new Color(0, 0, 0, 0);

            // Fill with transparent
            for (int x = 0; x < width; x++)
            {
                for (int y = 0; y < height; y++)
                {
                    _pillTexture.SetPixel(x, y, transparent);
                }
            }

            float centerY = height / 2f;
            float radius = height / 2f;
            float leftCapCenterX = radius;
            float rightCapCenterX = width - radius;

            for (int x = 0; x < width; x++)
            {
                for (int y = 0; y < height; y++)
                {
                    float distFromSurface;

                    if (x <= leftCapCenterX)
                    {
                        // Left cap - distance from semicircle edge
                        float dx = x - leftCapCenterX;
                        float dy = y - centerY;
                        float distFromCenter = Mathf.Sqrt(dx * dx + dy * dy);
                        distFromSurface = radius - distFromCenter;
                    }
                    else if (x >= rightCapCenterX)
                    {
                        // Right cap - distance from semicircle edge
                        float dx = x - rightCapCenterX;
                        float dy = y - centerY;
                        float distFromCenter = Mathf.Sqrt(dx * dx + dy * dy);
                        distFromSurface = radius - distFromCenter;
                    }
                    else
                    {
                        // Middle - distance from top/bottom edge
                        distFromSurface = Mathf.Min(y, height - 1 - y);
                    }

                    // Draw border
                    if (distFromSurface >= 0 && distFromSurface <= borderThickness)
                    {
                        float alpha = 1f;
                        if (distFromSurface < 1f)
                        {
                            alpha = distFromSurface;
                        }
                        else if (distFromSurface > borderThickness - 1f)
                        {
                            alpha = borderThickness - distFromSurface;
                        }

                        _pillTexture.SetPixel(x, y, new Color(1, 1, 1, alpha));
                    }
                }
            }

            _pillTexture.Apply();
        }

        /// <summary>
        /// Calculates distance from the pill edge (positive = inside, negative = outside).
        /// </summary>
        private float GetDistanceFromPillEdge(int x, int y, int width, int height, int radius)
        {
            float centerY = height / 2f;

            // Left cap
            if (x < radius)
            {
                float dx = x - radius;
                float dy = y - centerY;
                float distFromCenter = Mathf.Sqrt(dx * dx + dy * dy);
                return radius - distFromCenter;
            }
            // Right cap
            else if (x > width - radius)
            {
                float dx = x - (width - radius);
                float dy = y - centerY;
                float distFromCenter = Mathf.Sqrt(dx * dx + dy * dy);
                return radius - distFromCenter;
            }
            // Middle section
            else
            {
                float distFromTop = y;
                float distFromBottom = height - y;
                return Mathf.Min(distFromTop, distFromBottom);
            }
        }

        /// <summary>
        /// Creates the material used for outlines.
        /// </summary>
        private void CreateOutlineMaterial()
        {
            // Use unlit transparent shader
            _outlineMaterial = new Material(Shader.Find("Sprites/Default"));
            _outlineMaterial.color = outlineColor;
            _outlineMaterial.mainTexture = _pillTexture;
        }

        /// <summary>
        /// Refreshes word highlights based on current pending move.
        /// </summary>
        public void RefreshHighlights()
        {
            ClearHighlights();

            if (GameManager.Instance?.GameState == null) return;

            var pendingLetter = GameManager.Instance.PendingLetter;
            var pendingCastPosition = GameManager.Instance.PendingCastPosition;

            // Only show highlights if we have both a cast position and letter selected
            if (pendingLetter == null || pendingCastPosition == null) return;

            var words = GameManager.Instance.WordScorer.FindWordsAt(
                GameManager.Instance.GameState,
                pendingCastPosition.Value,
                pendingLetter.Value);

            foreach (var word in words)
            {
                CreateWordOutline(word);
            }
        }

        /// <summary>
        /// Highlights words that would be formed at a specific position with a specific letter.
        /// Used by AI to show its move.
        /// </summary>
        public void HighlightWordsAt(HexCoord position, char letter)
        {
            ClearHighlights();

            if (GameManager.Instance?.GameState == null) return;

            var words = GameManager.Instance.WordScorer.FindWordsAt(
                GameManager.Instance.GameState,
                position,
                letter);

            foreach (var word in words)
            {
                CreateWordOutline(word);
            }
        }

        /// <summary>
        /// Creates an outline around a word using 3 parts: left cap, middle, right cap.
        /// This prevents the rounded ends from stretching.
        /// </summary>
        private void CreateWordOutline(WordResult word)
        {
            if (word.Positions == null || word.Positions.Count < 2) return;

            // Get board renderer for hex positions
            if (BoardRenderer.Instance == null) return;

            // Get world positions of first and last tiles
            HexCoord firstHex = word.Positions[0];
            HexCoord lastHex = word.Positions[word.Positions.Count - 1];

            Vector3 startPos = BoardRenderer.Instance.HexToWorld(firstHex);
            Vector3 endPos = BoardRenderer.Instance.HexToWorld(lastHex);

            float hexSize = BoardRenderer.Instance.hexSize;

            // Extend to tile edges (half a hex beyond center)
            Vector3 direction = (endPos - startPos).normalized;
            startPos -= direction * (hexSize * .95f);
            endPos += direction * (hexSize * 0.95f);

            // Calculate rotation
            float angle = Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg;
            Quaternion rotation = Quaternion.Euler(90f, angle + 90f, 0f);

            float capWidth = outlineWidth * 0.5f;  // Cap width is half the height to match UV ratio
            float totalLength = Vector3.Distance(startPos, endPos);
            float middleLength = totalLength - (capWidth * 2f);

            // Left cap
            Vector3 leftCapPos = startPos + direction * (capWidth * 0.5f);
            leftCapPos.y = outlineHeight;
            CreateOutlinePart(leftCapPos, rotation, new Vector3(capWidth, outlineWidth, 1f),
                GetCapUVs(true), $"WordOutline_{word.Letters}_LeftCap");

            // Middle section
            if (middleLength > 0)
            {
                Vector3 middlePos = (startPos + endPos) / 2f;
                middlePos.y = outlineHeight;
                CreateOutlinePart(middlePos, rotation, new Vector3(middleLength, outlineWidth, 1f),
                    GetMiddleUVs(), $"WordOutline_{word.Letters}_Middle");
            }

            // Right cap
            Vector3 rightCapPos = endPos - direction * (capWidth * 0.5f);
            rightCapPos.y = outlineHeight;
            CreateOutlinePart(rightCapPos, rotation, new Vector3(capWidth, outlineWidth, 1f),
                GetCapUVs(false), $"WordOutline_{word.Letters}_RightCap");
        }

        /// <summary>
        /// Creates a single part of the outline (cap or middle).
        /// </summary>
        private void CreateOutlinePart(Vector3 position, Quaternion rotation, Vector3 scale, Vector2[] uvs, string name)
        {
            GameObject part = GameObject.CreatePrimitive(PrimitiveType.Quad);
            part.name = name;
            part.transform.SetParent(transform);
            part.transform.position = position;
            part.transform.rotation = rotation;
            part.transform.localScale = scale;

            // Remove collider
            Destroy(part.GetComponent<Collider>());

            // Apply UVs for 3-slice
            Mesh mesh = part.GetComponent<MeshFilter>().mesh;
            mesh.uv = uvs;

            // Apply material
            var renderer = part.GetComponent<Renderer>();
            renderer.material = _outlineMaterial;

            _activeOutlines.Add(part);
        }

        /// <summary>
        /// Gets UVs for the cap portions of the pill (left or right quarter).
        /// </summary>
        private Vector2[] GetCapUVs(bool isLeft)
        {
            // Texture is 2:1 ratio, so caps are 0-0.25 and 0.75-1.0
            if (isLeft)
            {
                return new Vector2[]
                {
                    new Vector2(0.25f, 1f),
                    new Vector2(0f, 1f),
                    new Vector2(0.25f, 0f),
                    new Vector2(0f, 0f)
                };
            }
            else
            {
                return new Vector2[]
                {
                    new Vector2(1f, 1f),
                    new Vector2(0.75f, 1f),
                    new Vector2(1f, 0f),
                    new Vector2(0.75f, 0f)
                };
            }
        }

        /// <summary>
        /// Gets UVs for the middle stretchable portion of the pill.
        /// </summary>
        private Vector2[] GetMiddleUVs()
        {
            // Middle half of texture (0.25 to 0.75)
            return new Vector2[]
            {
                new Vector2(0.25f, 0f),
                new Vector2(0.75f, 0f),
                new Vector2(0.25f, 1f),
                new Vector2(0.75f, 1f)
            };
        }

        /// <summary>
        /// Removes all active outlines.
        /// </summary>
        public void ClearHighlights()
        {
            foreach (var outline in _activeOutlines)
            {
                if (outline != null)
                {
                    Destroy(outline);
                }
            }
            _activeOutlines.Clear();
        }
    }
}