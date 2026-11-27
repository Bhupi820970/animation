import React from 'react';
import { Composition } from 'remotion';
import { StoryVideo, calculateStoryFrames } from './StoryVideo.jsx';
import { SmokePreview, smokeProps } from './SmokePreview.jsx';

const emptyProps = {
  title: '',
  description: '',
  storyId: '',
  genre: '',
  titleDurationInFrames: 60,
  endCardDurationInFrames: 150,
  overlapFrames: 12,
  musicFile: 'music.mp3',
  grainFile: 'grain.jpg',
  imageSource: '',
  fallbackScenes: [],
  scenes: [],
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="StoryVideo"
        component={StoryVideo}
        durationInFrames={30}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={emptyProps}
        timeoutInMilliseconds={180000}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateStoryFrames(props) || 30,
        })}
      />
      <Composition
        id="SmokePreview"
        component={SmokePreview}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        defaultProps={smokeProps}
      />
    </>
  );
};
