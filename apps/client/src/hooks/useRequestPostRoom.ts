import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRoom } from "../apis/room";
import { QUERY_KEYS } from "../constants/queryKeys";

export const useRequestPostRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createRoom(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ROOMS] });
    },
    
  });
};
