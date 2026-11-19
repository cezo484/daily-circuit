import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'Daily Circuit: a new circuit puzzle every day',
  });
};
