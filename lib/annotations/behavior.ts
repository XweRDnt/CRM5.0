export type AnnotationPlaybackPolicy = {
  hideOnPlay: boolean;
  pauseOnCommentSelect: boolean;
};

export const getAnnotationPlaybackPolicy = (): AnnotationPlaybackPolicy => ({
  hideOnPlay: true,
  pauseOnCommentSelect: true,
});
