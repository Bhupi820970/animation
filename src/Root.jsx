import React from 'react';
import { Composition } from 'remotion';
import { StoryVideo } from './StoryVideo.jsx';

const emptyProps = {
  title: '',
  description: '',
  storyId: '',
  scenes: [],
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="StoryVideo"
      component={StoryVideo}
      durationInFrames={30}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={emptyProps}
      calculateMetadata={({ props }) => {
        const totalFrames = (props.scenes || []).reduce(
          (sum, scene) => sum + (scene.durationInFrames || 0),
          0,
        );
        return {
          durationInFrames: totalFrames || 30,
        };
      }}
    />
  );
};
