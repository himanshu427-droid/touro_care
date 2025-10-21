import axios from "axios";

const API_BASE =
  "http://localhost:4000/api/tourist"


const detailsApi = axios.create({
  baseURL: API_BASE,
});

const authHeaders = (token?: string) => ({
  Authorization: token ? `Bearer ${token}` : "",
});

// const { destination, checkInDate, checkOutDate, accommodation, purpose } = tripData;

export const submitTripDetails = async(tripData:any, token:any)=>{
    const {tripDets, emergencyContacts} = tripData
    const { destination, checkInDate, checkOutDate, accommodation, purpose } = tripDets;

    // Format the request payload according to the schema requirements
    const res = await detailsApi.post("/register", {
        itinerary: {
            destinations: [{
                location: destination,  // Add location property
                startDate: new Date(checkInDate).toISOString(),  // Add startDate
                endDate: new Date(checkOutDate).toISOString(),   // Add endDate
            }],
            accommodation,
            purpose
        },
        expiryAt: new Date(checkOutDate).toISOString(),
        emergencyContacts,
        deviceId: "Device07"
    }, {
        headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
        },
    });

    return res.data;
}