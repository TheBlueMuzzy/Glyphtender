using UnityEngine;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Represents an active position tween.
    /// </summary>
    public class Tween
    {
        public Transform Target;
        public Vector3 StartPosition;
        public Vector3 EndPosition;
        public float Duration;
        public float ElapsedTime;
        public System.Action OnComplete;

        public bool IsComplete => ElapsedTime >= Duration;
    }

    /// <summary>
    /// Manages position tweens with smoothstep easing.
    /// </summary>
    public class TweenManager : MonoBehaviour
    {
        public static TweenManager Instance { get; private set; }

        private List<Tween> _activeTweens = new List<Tween>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        /// <summary>
        /// Ensures TweenManager exists in scene.
        /// </summary>
        public static TweenManager EnsureExists()
        {
            if (Instance == null)
            {
                var go = new GameObject("TweenManager");
                Instance = go.AddComponent<TweenManager>();
            }
            return Instance;
        }

        /// <summary>
        /// Starts a position tween.
        /// </summary>
        public Tween MoveTo(Transform target, Vector3 endPosition, float duration, System.Action onComplete = null)
        {
            // Cancel any existing tween on this target
            CancelTweensOn(target);

            var tween = new Tween
            {
                Target = target,
                StartPosition = target.position,
                EndPosition = endPosition,
                Duration = duration,
                ElapsedTime = 0f,
                OnComplete = onComplete
            };
            _activeTweens.Add(tween);
            return tween;
        }

        /// <summary>
        /// Starts a position tween from a specific start position.
        /// </summary>
        public Tween MoveFromTo(Transform target, Vector3 startPosition, Vector3 endPosition, float duration, System.Action onComplete = null)
        {
            // Cancel any existing tween on this target
            CancelTweensOn(target);

            var tween = new Tween
            {
                Target = target,
                StartPosition = startPosition,
                EndPosition = endPosition,
                Duration = duration,
                ElapsedTime = 0f,
                OnComplete = onComplete
            };
            _activeTweens.Add(tween);
            return tween;
        }

        /// <summary>
        /// Cancels all tweens on a target.
        /// </summary>
        public void CancelTweensOn(Transform target)
        {
            _activeTweens.RemoveAll(t => t.Target == target);
        }

        /// <summary>
        /// Cancels all active tweens.
        /// </summary>
        public void CancelAll()
        {
            _activeTweens.Clear();
        }

        private void Update()
        {
            for (int i = _activeTweens.Count - 1; i >= 0; i--)
            {
                var tween = _activeTweens[i];

                // Handle destroyed objects
                if (tween.Target == null)
                {
                    _activeTweens.RemoveAt(i);
                    continue;
                }

                tween.ElapsedTime += Time.deltaTime;

                float t = Mathf.Clamp01(tween.ElapsedTime / tween.Duration);

                // Smoothstep easing
                t = t * t * (3f - 2f * t);

                tween.Target.position = Vector3.Lerp(tween.StartPosition, tween.EndPosition, t);

                if (tween.IsComplete)
                {
                    tween.OnComplete?.Invoke();
                    _activeTweens.RemoveAt(i);
                }
            }
        }
    }
}