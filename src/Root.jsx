import React from 'react';
import { Composition } from 'remotion';
import { StoryVideo } from './StoryVideo';
import videoData from '../public/current_video.json';

export const RemotionRoot = () => {
  const totalFrames = videoData.scenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0,
  );

  return (
    <Composition
      id="StoryVideo"
      component={StoryVideo}
      durationInFrames={totalFrames || 300}
      fps={30}
      width={1280}
      height={720}
    />
  );
};
